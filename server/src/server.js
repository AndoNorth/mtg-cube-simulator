require('dotenv').config();

const express = require('express');
const cors = require('cors');
const body_parser = require('body-parser');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const { DraftingSession, Player } = require('./game/game');

const app = express();
app.use(cors());
app.use(body_parser.json());
app.use(body_parser.urlencoded({ extended: false }));

// constants
const MAX_NO_PLAYERS = 8;
const SECRET_KEY = 'jellybeans';

// sessions
const sessions = {};

// --------------------
// Helpers
// --------------------

function generateSessionId() {
  return Math.random().toString(36).substring(2, 8);
}

function emitSessionState(io, session_id) {
  const session = sessions[session_id];
  if (!session) return;

  const players = session.m_players.map(p => ({
    name: p.m_name,
    ready: !!p.m_ready,
    connected: !!p.m_id,
    isOwner: !!p.m_isOwner,
  }));

  const owner = players.find(p => p.isOwner)?.name || null;
  const canStart =
    players.length > 1 && players.every(p => p.ready);

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

app.post('/createSession', (req, res) => {
  let session_id;
  do {
    session_id = generateSessionId();
  } while (sessions[session_id]);

  const cards_per_pack = 15;
  const no_packs = 3;
  const no_players = 8;
  const draft = new DraftingSession(cards_per_pack,no_packs,no_players);
  draft.createSession();

  sessions[session_id] = draft;

  console.log(`Session created: ${session_id}`);
  res.json({ session_id });
});

app.get('/cube', (req, res) => {
  const filename = 'PauperCubeInitial_20231126.txt';
  const file = path.join('../local/', filename);
  const data = fs.readFileSync(file, 'utf8');

  res.send(data.split(/\r?\n/));
});

// --------------------
// Server
// --------------------

const port_no = process.env.PORT || 5000;
const server = app.listen(port_no, () => {
  console.log(`Listening on port ${port_no}`);
});

const io = socketIO(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// --------------------
// WebSockets
// --------------------

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // --------------------
  // Authentication (reconnect)
  // --------------------
  socket.on('authenticate', (token) => {
    try {
      const { session_id, player_name } = jwt.verify(token, SECRET_KEY);
      const session = sessions[session_id];
      if (!session) return;

      const player = session.m_players.find(
        p => p.m_name === player_name
      );

      if (player) {
        player.m_id = socket.id;
        socket.join(session_id);
        emitSessionState(io, session_id);
      }
    } catch (err) {
      console.log('Auth failed:', err.message);
    }
  });

  // --------------------
  // Join session
  // --------------------
  socket.on('joinSession', (session_id, player_name) => {
    const session = sessions[session_id];
    if (!session) {
      socket.emit('sessionError', 'Invalid session');
      return;
    }

    if (session.m_players.length >= MAX_NO_PLAYERS) {
      socket.emit('sessionError', 'Session is full');
      return;
    }

    let player = session.m_players.find(p => p.m_name === player_name);

    if (!player) {
      player = new Player(socket.id, player_name, false);
      player.m_ready = false;

      // First player becomes owner
      if (session.m_players.length === 0) {
        player.m_isOwner = true;
      }

      session.addPlayer(player);
    } else {
      player.m_id = socket.id;
    }

    const token = jwt.sign({ session_id, player_name }, SECRET_KEY);
    socket.emit('authenticated', token);

    socket.join(session_id);
    emitSessionState(io, session_id);
  });

  // --------------------
  // Ready toggle
  // --------------------
  socket.on('ready', (session_id) => {
    const session = sessions[session_id];
    if (!session) return;

    const player = session.m_players.find(p => p.m_id === socket.id);
    if (!player) return;

    player.m_ready = !player.m_ready;
    emitSessionState(io, session_id);
  });

  // --------------------
  // Disconnect
  // --------------------
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);

    for (const session_id in sessions) {
      const session = sessions[session_id];
      const player = session.m_players.find(p => p.m_id === socket.id);

      if (!player) continue;

      player.m_id = null;
      player.m_ready = false;

      // Transfer ownership if needed
      if (player.m_isOwner) {
        player.m_isOwner = false;
        const nextOwner = session.m_players.find(p => p.m_id);
        if (nextOwner) nextOwner.m_isOwner = true;
      }

      emitSessionState(io, session_id);
      break;
    }
  });
});

