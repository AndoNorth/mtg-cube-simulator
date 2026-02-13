import { Socket, Server as SocketIOServer } from 'socket.io';
import { getSession } from '../state/sessions';
import { handlePick } from '../state/draft';

export function registerDraftSockets(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    socket.on('pickCard', (session_id: string, card_id: number) => {
      const session = getSession(session_id);
      if (!session) {
        socket.emit('draftError', 'Session not found');
        return;
      }

      if (!session.m_started) {
        socket.emit('draftError', 'Draft has not started');
        return;
      }

      const error = handlePick(io, session_id, session, socket.id, card_id);
      if (error) {
        socket.emit('draftError', error);
      }
    });
  });
}
