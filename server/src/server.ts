import 'dotenv/config';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import bodyParser from 'body-parser';
import { registerSessionRoutes } from './api/session';
import { registerLobbySockets } from './sockets/lobby';

const app = express();
app.use(cors());
app.use(bodyParser.json());
registerSessionRoutes(app);

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: 'http://localhost:5173' } });
registerLobbySockets(io);

const port_no = process.env.PORT || 5000;
server.listen(port_no, () => console.log(`Server listening on [${port_no}]`));

