export interface DraftCard {
  id: number;
  name: string;
}

export interface DraftPick {
  id: number;
  name: string;
  packNumber: number;
  pickNumber: number;
}

export interface DraftStatePayload {
  currentRound: number;
  currentPick: number;
  totalRounds: number;
  packSize: number;
  draftFinished: boolean;
  pack: DraftCard[];
  picks: DraftPick[];
  waitingForOthers: boolean;
}
