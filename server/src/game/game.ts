import path from 'path';
import fs from 'fs';
import seedrandom from 'seedrandom';

/* =======================
 * Core domain objects
 * ======================= */

export class Card {
  m_owner_id: string | null = null;
  m_pack_id = 0;
  m_id_in_pack = 0;
  m_pick_no = 0;

  constructor(
    public m_id: number,
    public m_name: string
  ) {}
}

export class Pack {
  m_cards: Card[] = [];
  m_chosen_cards: Card[] = [];
  m_pack_id = 0;

  addCard(card: Card) {
    this.m_cards.push(card);
    card.m_id_in_pack = this.m_cards.length - 1;
  }

  chooseCardWithId(id: number): Card | undefined {
    const chosen_card = this.m_cards.find(c => c.m_id_in_pack === id);
    if (!chosen_card) return undefined;

    this.m_chosen_cards.push(chosen_card);
    chosen_card.m_pick_no = this.m_chosen_cards.length;
    return chosen_card;
  }

  cardsLeft(): Card[] {
    return this.m_cards.filter(c => !this.m_chosen_cards.includes(c));
  }

  isEmpty(): boolean {
    return this.cardsLeft().length === 0;
  }
}

export class Player {
  m_drafted_cards: Card[] = [];
  m_ready: boolean = false;
  m_isOwner: boolean = false;

  constructor(
    public m_id: string | null, // socket id or null
    public m_name: string,
    public m_is_bot: boolean
  ) {}

  pickCard(pack: Pack, id: number): void {
    // Humans must be connected; bots always allowed
    if (!this.m_is_bot && !this.m_id) return;

    const card = pack.chooseCardWithId(id);
    if (card) {
      this.m_drafted_cards.push(card);
      card.m_owner_id = this.m_id;
    }
  }
}

/* =======================
 * Draft runtime state
 * ======================= */

export class DraftingSession {
  // Static setup
  m_players: Player[] = [];
  m_card_pool: Card[] = [];
  m_draft_pool: Card[] = [];
  m_packs: Pack[] = [];

  // Draft runtime
  m_started = false;
  m_currentRound = 0;
  m_currentPick = 0;

  /** Active pack per player name */
  m_packByPlayer: Map<string, Pack> = new Map();

  /** Which players have picked this step */
  m_pickedThisStep: Set<string> = new Set();

  constructor(
    public m_pack_size: number,
    public m_no_packs: number,
    public m_no_players: number
  ) {
    this.m_no_players = Math.min(m_no_players, 8);
  }

  private m_random_seed = 50292030;

  /* =======================
   * Session setup
   * ======================= */

  loadCards(): void {
    const filename = 'PauperCubeInitial_20231126.txt';
    const file = path.join('../local/', filename);
    if (!fs.existsSync(file)) {
      console.error(`File "${file}" does not exist.`);
      return;
    }

    let card_id = 0;
    const data = fs.readFileSync(file, 'utf8');
    data.split(/\r?\n/).forEach((line) => {
      this.m_card_pool.push(new Card(card_id++, line));
    });
  }

  createSession(): void {
    this.loadCards();

    const min_no_cards =
      this.m_pack_size * this.m_no_packs * this.m_no_players;

    if (this.m_card_pool.length < min_no_cards) {
      console.error('Not enough cards in pool to start draft');
      return;
    }

    const shuffled = this.seededShuffle(
      this.m_card_pool,
      this.m_random_seed
    );

    this.m_draft_pool = shuffled.slice(0, min_no_cards);
    this.m_packs = this.initializePacks(this.m_draft_pool);
  }

  addPlayer(player: Player) {
    this.m_players.push(player);
  }

  initializePlayers() {
    const no_bots = this.m_no_players - this.m_players.length;
    for (let i = 0; i < no_bots; i++) {
      this.m_players.push(
        new Player(`BOT_${i + 1}`, `Bot ${i + 1}`, true)
      );
    }
  }

  initializePacks(card_pool: Card[]): Pack[] {
    const packs: Pack[] = [];
    let idx = 0;

    for (let p = 0; p < this.m_no_players; p++) {
      for (let r = 0; r < this.m_no_packs; r++) {
        const pack = new Pack();
        pack.m_pack_id = r + 1;

        for (let k = 0; k < this.m_pack_size; k++) {
          const card = card_pool[idx++];
          pack.addCard(card);
          card.m_pack_id = r + 1;
        }

        packs.push(pack);
      }
    }

    return packs;
  }

  /* =======================
   * Draft lifecycle
   * ======================= */

  /**
   * Called once by lobby owner
   * Pure state initialization — no sockets, no timers
   */
  startDraft(): void {
    if (this.m_started) return;

    this.initializePlayers();

    this.m_started = true;
    this.m_currentRound = 0;
    this.m_currentPick = 0;
    this.m_pickedThisStep.clear();
    this.m_packByPlayer.clear();

    this.assignInitialPacks();
  }

  /**
   * Assign packs for the current round & pick
   */
  assignInitialPacks(): void {
    const start =
      this.m_currentRound * this.m_no_players;

    const packsForRound = this.m_packs.slice(
      start,
      start + this.m_no_players
    );

    this.m_players.forEach((player, i) => {
      this.m_packByPlayer.set(player.m_name, packsForRound[i]);
    });
  }

  /**
   * Called when a player (or bot) finishes picking
   */
  markPicked(playerName: string) {
    this.m_pickedThisStep.add(playerName);
  }

  allPlayersPicked(): boolean {
    return this.m_pickedThisStep.size === this.m_players.length;
  }

  /**
   * Rotate packs after a completed pick
   */
  advancePick(): void {
    this.m_pickedThisStep.clear();
    this.m_currentPick++;

    const rotateLeft = this.m_currentRound % 2 === 0;
    const packs = this.m_players.map(
      p => this.m_packByPlayer.get(p.m_name)!
    );

    if (rotateLeft) {
      packs.push(packs.shift()!);
    } else {
      packs.unshift(packs.pop()!);
    }

    this.m_players.forEach((p, i) => {
      this.m_packByPlayer.set(p.m_name, packs[i]);
    });

    if (this.m_currentPick >= this.m_pack_size) {
      this.advanceRound();
    }
  }

  advanceRound(): void {
    this.m_currentRound++;
    this.m_currentPick = 0;
    this.assignInitialPacks();
  }

  /* =======================
   * Utilities
   * ======================= */

  private seededShuffle(array: Card[], seed: number): Card[] {
    const rng = seedrandom(seed.toString());
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }

  /* =======================
   * Testing
   * ======================= */

  simulateDraft(): void {
    this.initializePlayers();

    for (let round = 0; round < this.m_no_packs; round++) {
      const packs_in_round = this.m_packs.slice(
        this.m_no_players * round,
        Math.min(this.m_no_players * (round + 1), this.m_packs.length)
      );

      for (let pick_no = 0; pick_no < this.m_pack_size; pick_no++) {
        for (let player_idx = 0; player_idx < this.m_no_players; player_idx++) {
          const current_pack = packs_in_round[player_idx];
          const player = this.m_players[player_idx];

          const available_picks = current_pack.cardsLeft();
          const random_idx = Math.floor(seedrandom(`${this.m_random_seed}`)() * available_picks.length);
          const chosen_card = available_picks[Math.max(random_idx - 1, 0)];
          if (chosen_card) player.pickCard(current_pack, chosen_card.m_id_in_pack);
        }

        // Shift packs
        if (round % 2 === 0) packs_in_round.push(packs_in_round.shift()!);
        else packs_in_round.unshift(packs_in_round.pop()!);
      }

      if (packs_in_round.every(pack => pack.cardsLeft().length === 0)) {
        console.log('All cards drafted from packs');
      }
    }
  }
}

/* =======================
 * Placeholders
 * ======================= */

export const SCRYFALL_API =
  'https://api.scryfall.com/cards/named?fuzzy=';
export const MAX_REQ_PER_SEC = 10;
export function Scryfall() {}

