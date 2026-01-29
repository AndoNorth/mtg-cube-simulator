import { Express, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { DraftingSession, Player } from '../game/game';
import { sessions } from '../state/sessions';

const MAX_NO_PLAYERS = 8;

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 8);
}

export function registerSessionRoutes(app: Express) {
  app.post('/createSession', (_req: Request, res: Response) => {
    let session_id: string;
    do {
      session_id = generateSessionId();
    } while (sessions[session_id]);

    const draft = new DraftingSession(15, 3, MAX_NO_PLAYERS);
    draft.createSession();

    for (let i = 1; i < MAX_NO_PLAYERS; i++) {
      const bot = new Player(`BOT_${i}`, `Bot ${i}`, true);
      bot.m_ready = true;
      draft.addPlayer(bot);
    }

    sessions[session_id] = Object.assign(draft, { 
      m_kickedPlayers: new Set<string>(), 
      m_disconnectTimeouts: new Map<string, {timeout: NodeJS.Timeout; expiresAt: number}>(), 
      m_started: false,
    });

    console.log(`Session created with id [${session_id}]`)
    res.json({ session_id });
  });

  app.get('/cube', (_req: Request, res: Response) => {
    const file = path.join('../local/', 'PauperCubeInitial_20231126.txt');
    if (!fs.existsSync(file)) return res.status(404).send('File not found');
    res.send(fs.readFileSync(file, 'utf8').split(/\r?\n/));
  });
}

