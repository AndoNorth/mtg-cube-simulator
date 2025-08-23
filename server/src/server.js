require('dotenv').config()

const Joi = require("joi"); // npm i joi@13.1.0
const express = require("express"); // npm i express
const cors = require("cors") // npm i cors
const body_parser = require("body-parser"); // npm i body-parser
const socketIO = require('socket.io'); // npm i socket.io
const jwt = require('jsonwebtoken') // npm i jsonwebtoken

const path = require("path"); // npm i path
const fs = require("fs"); // npm i fs

const { DraftingSession, Player} = require('./game/game')

const app = express();
app.use(cors())

const json_parser = body_parser.json();
app.use(json_parser);
const encoded_parser = body_parser.urlencoded({ extended: false });
app.use(encoded_parser);

// constants
const MAX_NO_PLAYERS = 8;
const SECRET_KEY = 'jellybeans';

// sessions
const sessions = {};

// Function to generate a unique session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 8);
}

app.post('/createSession', (req, res) => {
  // repeat until unique session id
  while (true) {
    var session_id = generateSessionId();
    if(!sessions.hasOwnProperty(session_id)){
      break;
    }
  }

  var pack_size = 15;
  var no_packs = 3;
  var no_players = 8;
  var draft = new DraftingSession(pack_size, no_packs, no_players);
  draft.createSession();

  sessions[session_id] = draft;
  console.log(`session created return id: ${session_id}`);
  
  res.json({session_id});
});

app.post("/startDraft/:id", (req, res) => {
  console.log("start draft for session id:" + req.params.id);
  const session_id = req.params.id;
  sessions[session_id].draft;
});

// REST APIs
/**
 * get all cards
 */
app.get("/cube", (req, res) => {
  const card_names = [];
  const filename = "PauperCubeInitial_20231126.txt"
  const file = path.join("../local/", filename)
  data = fs.readFileSync(file, 'utf8');
  data.split(/\r?\n/).forEach((data) => {
    data_str = data.toString()
    card_names.push(data_str)
  });
  // res.send(JSON.stringify(cards));
  res.send(card_names);
});


// HTTP Server
const default_port = 5000;
const port_no = process.env.PORT || default_port;
const server = app.listen(port_no, () => {
  console.log(`Listening on port ${port_no}`);
});

// socket io event manager
const io = socketIO(server, {
  cors: {
    origin: `http://127.0.0.1:5173`, // only for development, this would be changed in production
    methods: ["GET", "POST"]
  }
});

// WebSocket server side events 
io.on('connection', (socket) => {
  console.log('A user connected');
  // Auth
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      const player = sessions[decoded.session_id].m_players
        .find(player => player.m_name === decoded.player_name);

      if (player) {
        player.m_socket_id = socket.id;
      } else {
        console.log(`authentication failed: player doesnt exist`)
      }
    } catch (err) {
      console.log('authentication failed:', err.message);
    }
  });
  // Handle joining a draft session
  socket.on('joinSession', (session_id, player_name) => {
    if (sessions[session_id]) {
      if (sessions[session_id].m_players.length >= MAX_NO_PLAYERS) {
        socket.emit('sessionError', 'Session is full')
        return;
      }
      // authenticate the player
      const token = jwt.sign({ session_id, player_name}, SECRET_KEY);
      socket.emit('authenticated', token);

      console.log(`${player_name} joined, session ${session_id}`)
      // Store the player information in the session
      const player = new Player(socket.id, player_name, true);
      sessions[session_id].addPlayer(player)
      // Join the socket room for the specific session
      socket.join(session_id);

      // Notify all players in the session about the new player
      io.to(session_id).emit('playerJoined',
        sessions[session_id].m_players.map(player => player.m_name));
    } else {
      // Handle invalid session
      socket.emit('sessionError', 'Invalid session ID');
    }
  });

  socket.on('ready', (session_id, playerName) => {

  });

  // Handle disconnect
  socket.on('disconnect', () => {
    for (const session_id in sessions) {
      const session = sessions[session_id];
      const disconnected_player = session.m_players.find(player =>  {
        // console.log(`${player.m_id} === ${socket.id}`);
        player.m_id === socket.id
      });
      if (disconnected_player) {
        console.log(`${disconnected_player.m_name} disconnected`);
        break;
      }
    }
  });

});