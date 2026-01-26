import path from 'path';
import fs from 'fs';
import seedrandom from 'seedrandom';

// --------------------
// Types
// --------------------
export class Card {
  m_owner_id: string | number = 0;
  m_pack_id = 0;
  m_id_in_pack = 0;
  m_pick_no = 0;

  constructor(
    public m_id: number,
    public m_name: string
  ) {}
}

// --------------------
export class Pack {
  m_cards: Card[] = [];
  m_chosen_cards: Card[] = [];
  m_pack_id = 0;

  addCard(card: Card) {
    this.m_cards.push(card);
    card.m_id_in_pack = this.m_cards.length;
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
}

// --------------------
export class Player {
  m_drafted_cards: Card[] = [];
  m_ready: boolean = false;
  m_isOwner: boolean = false;

  constructor(
    public m_id: string,
    public m_name: string,
    public m_is_bot: boolean
  ) {}

  pickCard(pack: Pack, id: number): void {
    const card = pack.chooseCardWithId(id);
    if (card) {
      this.m_drafted_cards.push(card);
      card.m_owner_id = this.m_id;
    }
  }
}

// --------------------
export class DraftingSession {
  m_players: Player[] = [];
  m_card_pool: Card[] = [];
  m_draft_pool: Card[] = [];
  m_packs: Pack[] = [];

  constructor(
    public m_pack_size: number,
    public m_no_packs: number,
    public m_no_players: number
  ) {
    this.m_no_players = Math.min(m_no_players, 8);
  }

  private m_time_limit = 30;
  private m_random_seed = 50292030;

  // --------------------
  // Load cards from file
  // --------------------
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

  // --------------------
  createSession(): void {
    this.loadCards();

    const min_no_cards = this.m_pack_size * this.m_no_packs * this.m_no_players;
    if (this.m_card_pool.length < min_no_cards) {
      console.error('Not enough cards in pool to start draft');
      return;
    }

    const shuffled_card_pool = this.seededShuffle(this.m_card_pool, this.m_random_seed);
    this.m_draft_pool = shuffled_card_pool.slice(0, min_no_cards);
    this.m_packs = this.initializePacks(this.m_draft_pool);

    console.log('Session initialized');
  }

  // --------------------
  addPlayer(player: Player) {
    this.m_players.push(player);
  }

  initializePlayers() {
    const no_bots = this.m_no_players - this.m_players.length;
    for (let i = 0; i < no_bots; i++) {
      const bot = new Player(`BOT_${i + 1}`, `Bot ${i + 1}`, true);
      this.m_players.push(bot);
    }
  }

  // --------------------
  initializePacks(card_pool: Card[]): Pack[] {
    const packs: Pack[] = [];
    let idx = 0;

    for (let i = 0; i < this.m_no_players; i++) {
      for (let j = 0; j < this.m_no_packs; j++) {
        const pack = new Pack();
        pack.m_pack_id = j + 1;
        for (let k = 0; k < this.m_pack_size; k++) {
          const card = card_pool[idx++];
          pack.addCard(card);
          card.m_pack_id = j + 1;
        }
        packs.push(pack);
      }
    }
    return packs;
  }

  // --------------------
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

  // --------------------
  // Seeded shuffle
  private seededShuffle(array: Card[], seed: number): Card[] {
    const rng = seedrandom(seed.toString());
    const arrCopy = [...array];
    for (let i = arrCopy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arrCopy[i], arrCopy[j]] = [arrCopy[j], arrCopy[i]];
    }
    return arrCopy;
  }
}

export const SCRYFALL_API = 'https://api.scryfall.com/cards/named?fuzzy=';
export const MAX_REQ_PER_SEC = 10;
export function Scryfall() {}

