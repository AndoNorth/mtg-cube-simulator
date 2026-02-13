export interface SessionPlayer {
  name: string;
  ready: boolean;
  connected: boolean;
  isOwner: boolean;
  disconnected: number | null;
}

export interface SessionState {
  session_id: string;
  owner: string | null;
  players: SessionPlayer[];
  canStart: boolean;
  started: boolean;
}

