import { Server as SocketIOServer } from 'socket.io';
import { LobbySession, sessions } from './sessions';

export function emitDraftState(io: SocketIOServer, session_id: string) {
  const session = sessions[session_id];
  if (!session) return;

  console.log(JSON.stringify({
    event: 'emitDraftState',
    sessionId: session_id,
    numPlayers: session.m_players.length,
    numPacks: session.m_packs.length,
    currentRound: session.m_currentRound,
    currentPick: session.m_currentPick,
    timestamp: new Date().toISOString()
  }));

  for (const player of session.m_players) {
    if (player.m_is_bot || !player.m_id) continue;

    const pack = session.m_packByPlayer.get(player.m_name);
    const hasPicked = session.m_pickedThisStep.has(player.m_name);
    const draftFinished = session.m_currentRound >= session.m_no_packs;

    const cardsInPack = pack ? pack.m_cards.length : 0;
    const cardsChosen = pack ? pack.m_chosen_cards.length : 0;
    const cardsLeftCount = pack ? pack.cardsLeft().length : 0;

    console.log(JSON.stringify({
      event: 'emitDraftState.player',
      sessionId: session_id,
      playerName: player.m_name,
      hasPackAssigned: !!pack,
      cardsInPack,
      cardsChosen,
      cardsLeft: cardsLeftCount,
      hasPicked,
      draftFinished,
      willSendCards: !hasPicked && pack && !draftFinished,
      timestamp: new Date().toISOString()
    }));

    const availableCards = (!hasPicked && pack && !draftFinished)
      ? pack.cardsLeft().map(c => ({ id: c.m_id_in_pack, name: c.m_name }))
      : [];

    const picks = player.m_drafted_cards.map(c => ({
      id: c.m_id_in_pack,
      name: c.m_name,
      packNumber: c.m_pack_id,
      pickNumber: c.m_pick_no,
    }));

    io.to(player.m_id).emit('draftState', {
      currentRound: session.m_currentRound,
      currentPick: session.m_currentPick,
      totalRounds: session.m_no_packs,
      packSize: session.m_pack_size,
      draftFinished,
      pack: availableCards,
      picks,
      waitingForOthers: hasPicked && !draftFinished,
    });
  }
}

export function handleBotPicks(session: LobbySession) {
  for (const player of session.m_players) {
    if (!player.m_is_bot) continue;
    if (session.m_pickedThisStep.has(player.m_name)) continue;

    const pack = session.m_packByPlayer.get(player.m_name);
    if (!pack) continue;

    const available = pack.cardsLeft();
    if (available.length === 0) continue;

    const randomIdx = Math.floor(Math.random() * available.length);
    const chosen = available[randomIdx];
    player.pickCard(pack, chosen.m_id_in_pack);
    session.markPicked(player.m_name);
  }
}

export function checkAndAdvance(session: LobbySession) {
  while (session.allPlayersPicked() && session.m_currentRound < session.m_no_packs) {
    session.advancePick();

    if (session.m_currentPick === 0) break; // Round ended, stop here
    handleBotPicks(session);
  }
}

export function handlePick(
  io: SocketIOServer,
  session_id: string,
  session: LobbySession,
  socketId: string,
  cardId: number,
) {
  const draftFinished = session.m_currentRound >= session.m_no_packs;
  if (draftFinished) return 'Draft is already finished';

  const player = session.m_players.find(p => p.m_id === socketId);
  if (!player) return 'Player not found';

  if (session.m_pickedThisStep.has(player.m_name)) return 'Already picked this step';

  const pack = session.m_packByPlayer.get(player.m_name);
  if (!pack) return 'No pack assigned';

  const card = pack.cardsLeft().find(c => c.m_id_in_pack === cardId);
  if (!card) return 'Card not found in pack';

  player.pickCard(pack, cardId);
  session.markPicked(player.m_name);

  handleBotPicks(session);
  checkAndAdvance(session);

  emitDraftState(io, session_id);
  return null;
}

export function initiateDraft(io: SocketIOServer, session_id: string, session: LobbySession) {
  session.startDraft();
  handleBotPicks(session);
  checkAndAdvance(session);
  emitDraftState(io, session_id);
}
