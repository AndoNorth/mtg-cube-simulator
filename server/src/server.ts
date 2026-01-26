import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import http from 'http';

import { DraftingSession, Player } from './game/game';

// --------------------
// Types
// --------------------
interface TokenPayload {
  session_id: string;
  player_name: string;
}

// --------------------
// Constants
// --------------------
const MAX_NO_PLAYERS = 8;
const SECRET_KEY = process.env.SECRET_KEY || 'jellybeans';

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// --------------------
// Sessions
// --------------------
const sessions: Record<string, DraftingSession> = {};

// --------------------
// Helpers
// --------------------
function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 8);
}

// Emit state for frontend
function emitSessionState(io: SocketIOServer, session_id: string) {
  const session = sessions[session_id];
  if (!session) return;

  const players = session.m_players.map(p => ({
    name: p.m_name,
    ready: !!p.m_ready,
    connected: !!p.m_id,
    isOwner: !!p.m_isOwner,
  }));

  const owner = players.find(p => p.isOwner)?.name || null;
  const canStart = players.length > 1 && players.every(p => p.ready && !p.is_bot);

  io.to(session_id).emit('sessionState', {
    session_id,
    owner,
    players,
    canStart,
  });
}

// --------------------
// REST APIs
// --------------------
app.post('/createSession', (req: Request, res: Response) => {
  let session_id: string;
  do {
    session_id = generateSessionId();
  } while (sessions[session_id]);

  const pack_size = 15;
  const no_packs = 3;
  const no_players = MAX_NO_PLAYERS;

  const draft = new DraftingSession(pack_size, no_packs, no_players);
  draft.createSession();

  // Initialize with bots
  for (let i = 1; i < no_players; i++) {
    const bot = new Player(`BOT_${i}`, `Bot ${i}`, true);
    bot.m_ready=true; // bots start ready
    draft.addPlayer(bot);
  }

  sessions[session_id] = draft;
  console.log(`Session created: ${session_id}`);
  res.json({ session_id });
});

app.get('/cube', (req: Request, res: Response) => {
  const filename = 'PauperCubeInitial_20231126.txt';
  const file = path.join('../local/', filename);
  if (!fs.existsSync(file)) return res.status(404).send('File not found');
  const data = fs.readFileSync(file, 'utf8');
  res.send(data.split(/\r?\n/));
});

// --------------------
// HTTP + Socket.IO
// --------------------
const port_no = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] },
});

// --------------------
// Socket Handlers
// --------------------
io.on('connection', (socket: Socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('authenticate', (token: string) => {
    try {
      const decoded = jwt.verify(token, SECRET_KEY) as TokenPayload;
      const session = sessions[decoded.session_id];
      if (!session) return;

      const player = session.m_players.find(p => p.m_name === decoded.player_name);
      if (player) {
        player.m_id = socket.id;
        socket.join(decoded.session_id);
        emitSessionState(io, decoded.session_id);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.log('Auth failed:', err.message);
      } else {
        console.log('Auth failed')
      }
    }
  });

  socket.on('joinSession', (session_id: string, player_name: string) => {
    const session = sessions[session_id];
    if (!session) {
      socket.emit('sessionError', 'Invalid session');
      return;
    }

    // Check if player already exists
    let player = session.m_players.find(p => p.m_name === player_name);

    if (!player) {
      // Find the first bot to replace
      const botIndex = session.m_players.findIndex(p => p.m_is_bot);
      if (botIndex !== -1) {
        const bot = session.m_players[botIndex];
        bot.m_name = player_name;
        bot.m_is_bot = false;
        bot.m_id = socket.id;
        bot.m_ready = false;
        player = bot;
      } else {
        // If no bots left, create a new human player (should rarely happen)
        player = new Player(socket.id, player_name, false);
        session.addPlayer(player);
      }
    } else {
      player.m_id = socket.id;
    }

    // Make first human the owner
    if (!session.m_players.some(p => p.m_isOwner && !p.m_is_bot)) {
      player.m_isOwner = true;
    }

    const token = jwt.sign({ session_id, player_name }, SECRET_KEY);
    socket.emit('authenticated', token);

    socket.join(session_id);
    emitSessionState(io, session_id);
  });

  socket.on('ready', (session_id: string) => {
    const session = sessions[session_id];
    if (!session) return;

    const player = session.m_players.find(p => p.m_id === socket.id);
    if (!player) return;

    player.m_ready = !player.m_ready;
    emitSessionState(io, session_id);
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);

    for (const session_id in sessions) {
      const session = sessions[session_id];
      const player = session.m_players.find(p => p.m_id === socket.id);
      if (!player) continue;

      player.m_id = null;
      player.m_ready = false;

      // Transfer ownership if the owner leaves
      if (player.m_isOwner) {
        player.m_isOwner = false;
        const nextOwner = session.m_players.find(p => p.m_id && !p.m_is_bot);
        if (nextOwner) nextOwner.m_isOwner = true;
      }

      emitSessionState(io, session_id);
      break;
    }
  });
});

// --------------------
// Start server
// --------------------
server.listen(port_no, () => console.log(`Listening on port ${port_no}`));

