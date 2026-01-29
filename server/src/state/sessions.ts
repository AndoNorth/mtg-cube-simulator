import { Socket, Server as SocketIOServer } from 'socket.io';
import { DraftingSession } from '../game/game';

export interface LobbySession extends DraftingSession {
  m_kickedPlayers: Set<string>;
  m_disconnectTimeouts: Map<string, { timeout: NodeJS.Timeout; expiresAt: number }>;
  m_started: boolean;
}

export const sessions: Record<string, LobbySession> = {};

export function getSession(session_id: string) {
  return sessions[session_id];
}

export function findPlayerBySocket(session: LobbySession, socket: Socket) {
  return session.m_players.find(p => p.m_id === socket.id);
}

export function transferOwnership(session: LobbySession) {
  const nextOwner = session.m_players.find(p => p.m_id && !p.m_is_bot);
  if (nextOwner) nextOwner.m_isOwner = true;
}

export function emitSessionState(io: SocketIOServer, session_id: string) {
  const session = sessions[session_id];
  if (!session) return;

  const owner = session.m_players.find(p => p.m_isOwner)?.m_name ?? null;
  const canStart = session.m_players.filter(p => !p.m_is_bot).length > 1 &&
                   session.m_players.filter(p => !p.m_is_bot).every(p => p.m_ready);

  const now = Date.now();

  const players = session.m_players.map(p => {
    const info = session.m_disconnectTimeouts.get(p.m_name);
    const disconnected = info ? Math.ceil((info.expiresAt - now) / 1000) : null;

    return {
      name: p.m_name,
      ready: !!p.m_ready,
      connected: !!p.m_id,
      isOwner: !!p.m_isOwner,
      disconnected, // seconds left before being replaced
    };
  });

  io.to(session_id).emit('sessionState', { session_id, owner, players, canStart });
}

export function addPlayerToSession(
  session: LobbySession,
  socketId: string,
  playerName: string
) {
  const player = session.m_players.find(p => p.m_name === playerName);

  if (player) {
    player.m_id = socketId;

    // Clear any pending disconnect timer
    const info = session.m_disconnectTimeouts.get(playerName);
    if (info) {
      clearTimeout(info.timeout);
      session.m_disconnectTimeouts.delete(playerName);
    }

    return player;
  }

  // Try to replace a bot
  const bot = session.m_players.find(p => p.m_is_bot);
  if (bot) {
    bot.m_name = playerName;
    bot.m_is_bot = false;
    bot.m_ready = false;
    bot.m_id = socketId;

    const info = session.m_disconnectTimeouts.get(playerName);
    if (info) {
      clearTimeout(info.timeout);
      session.m_disconnectTimeouts.delete(playerName);
    }

    // Make this player the owner if no non-bot owner exists
    if (!session.m_players.some(p => p.m_isOwner && !p.m_is_bot)) {
      bot.m_isOwner = true;
    }

    return bot;
  }

  // No bot to replace and player name not found → session full
  return false;
}

export function removePlayerFromSession(
  sessionId: string,
  session: LobbySession,
  socketId: string
) {
  const player = session.m_players.find(p => p.m_id === socketId);
  if (!player) return;

  player.m_id = null;
  player.m_ready = false;

  if (player.m_isOwner) {
    player.m_isOwner = false;
    transferOwnership(session);
  }

  // Count remaining connected humans
  const connectedHumans = session.m_players.filter(
    p => !p.m_is_bot && p.m_id
  );

  if (connectedHumans.length === 0 && !session.m_started) {
    console.log(`Cleaning up empty session ${sessionId}`);

    // Clear disconnect timers
    for (const info of session.m_disconnectTimeouts.values()) {
      clearTimeout(info.timeout);
    }

    delete sessions[sessionId];
  }
}

export function toggleReady(session: LobbySession, socketId: string) {
  const player = session.m_players.find(p => p.m_id === socketId);
  if (!player || player.m_is_bot) return;
  player.m_ready = !player.m_ready;
}

export function reorderPlayer(session: LobbySession, socketId: string, playerName: string, dir: 'up' | 'down') {
  const owner = session.m_players.find(p => p.m_id === socketId);
  if (!owner || !owner.m_isOwner) return;

  const idx = session.m_players.findIndex(p => p.m_name === playerName);
  if (idx === -1) return;
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= session.m_players.length) return;

  [session.m_players[idx], session.m_players[swapIdx]] = [session.m_players[swapIdx], session.m_players[idx]];
}

export function kickPlayer(io: SocketIOServer, sessionId: string, session: LobbySession, socketId: string, playerName: string) {
  const owner = session.m_players.find(p => p.m_id === socketId);
  if (!owner || !owner.m_isOwner) return;

  const target = session.m_players.find(p => p.m_name === playerName && !p.m_isOwner && !p.m_is_bot);
  if (!target) return;

  session.m_kickedPlayers.add(target.m_name);
  if (target.m_id) {
    const targetSocket = io.sockets.sockets.get(target.m_id);
    targetSocket?.emit('sessionError', 'You were kicked');
    targetSocket?.leave(sessionId); // <- pass sessionId instead of session.m_id
    targetSocket?.disconnect(true);
  }

  target.m_name = `BOT_${Math.random().toString(36).slice(2, 6)}`;
  target.m_is_bot = true;
  target.m_ready = true;
  target.m_id = null;
  target.m_isOwner = false;
}

export function startDraft(session: LobbySession, socketId: string) {
  const owner = session.m_players.find(p => p.m_id === socketId);
  if (!owner || !owner.m_isOwner) return;
  session.m_started = true;
}

export function markPlayerDisconnected(session: LobbySession, playerName: string) {
  const player = session.m_players.find(p => p.m_name === playerName);
  if (!player) return;

  player.m_id = null;
  player.m_ready = false;

  if (session.m_started) {
    player.m_name = `BOT_${Math.random().toString(36).slice(2, 6)}`;
    player.m_is_bot = true;
    player.m_ready = true;
  } else if (player.m_isOwner) {
    player.m_isOwner = false;
    transferOwnership(session);
  }

  session.m_disconnectTimeouts.delete(playerName);
}

