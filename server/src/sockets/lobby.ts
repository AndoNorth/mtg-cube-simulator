import { Socket, Server as SocketIOServer } from 'socket.io';
import { sessions, getSession, addPlayerToSession, removePlayerFromSession, toggleReady, reorderPlayer, kickPlayer, startDraft, emitSessionState, markPlayerDisconnected, LobbySession } from '../state/sessions';
import { Player } from '../game/game';

const DISCONNECT_TIMEOUT_MS = 30000;

export function registerLobbySockets(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    socket.on('joinSession', (session_id: string, player_name: string) => {
      const session = getSession(session_id);

      if (!session || session.m_kickedPlayers.has(player_name)) {
        socket.emit('sessionError', 'Invalid or kicked');
        socket.disconnect(true);
        return;
      }

      const player = addPlayerToSession(session, socket.id, player_name);

      if (!player) {
        socket.emit('sessionError', 'Session is full');
        return;
      }

      socket.join(session_id);
      emitSessionState(io, session_id);
    });

    socket.on('ready', session_id => {
      const s = getSession(session_id);
      if(s){
        toggleReady(s, socket.id);
        emitSessionState(io, session_id);
      }
    });

    socket.on('leaveSession', session_id => {
      const s = getSession(session_id);
      if(s){
        removePlayerFromSession(session_id, s, socket.id);
        socket.leave(session_id);emitSessionState(io, session_id);
      }
    });

    socket.on('kickPlayer', (session_id, playerName) => {
      const s = getSession(session_id);
      if(s){
        kickPlayer(io, session_id, s, socket.id, playerName);
        emitSessionState(io, session_id);
      }
    });

    socket.on('reorderPlayer', (session_id, playerName, dir) => {
      const s = getSession(session_id);
      if(s){
        reorderPlayer(s, socket.id, playerName, dir);
        emitSessionState(io, session_id);
      }
    });

    socket.on('startDraft', session_id => {
      const s = getSession(session_id);
      if(s){
        startDraft(s, socket.id);
        emitSessionState(io, session_id);
      }
    });

    socket.on('disconnect', () => {
      Object.entries(sessions).forEach(([sessionId, session]: [string, LobbySession]) => {
        const player = session.m_players.find((p: Player) => p.m_id === socket.id);
        if (!player) return;

        const expiresAt = Date.now() + DISCONNECT_TIMEOUT_MS;

        const timeout = setTimeout(() => {
          markPlayerDisconnected(session, player.m_name);
          emitSessionState(io, sessionId);
        }, DISCONNECT_TIMEOUT_MS);

        session.m_disconnectTimeouts.set(player.m_name, { timeout, expiresAt });
      });
    });

  });
}

