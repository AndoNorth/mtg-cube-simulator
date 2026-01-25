const path = require("path"); // npm i path
const fs = require("fs"); // npm i fs
const seedrandom = require("seedrandom"); // npm i seedrandom

// constants
const MAX_NO_PLAYERS = 8;

/**
 * perform a seeded randomization of input array,
 * using the provided seed
 * 
 * @param {*} array 
 * @param {*} seed
 * 
 * @returns seeded_array
 */
function seededShuffle(array, seed) {
  const rng = seedrandom(seed);
  const mapping = {};

  for (let i = array.length - 1; i > 0; i--) {
      // Generate a random index based on the remaining unshuffled elements
      const j = Math.floor(rng() * (i + 1));
      mapping[i] = j;
      // Swap current element with a randomly selected element
      [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

class Card {
  constructor(id, name){
    this.m_id = id;
    this.m_name = name;
    this.m_owner_id = 0;
    this.m_pack_id = 0;
    this.m_id_in_pack = 0;
    this.m_pick_no = 0;
  }
}

class Pack {
    constructor() {
        this.m_cards = [];
        this.m_chosen_cards = [];
        this.m_pack_id = 0;
    }

    addCard(card) {
      this.m_cards.push(card);
      card.m_id_in_pack = this.m_cards.length;
    }

    chooseCardWithId(id) {
      const chosen_card = this.m_cards.find(card => card.m_id_in_pack === id);
      this.m_chosen_cards.push(chosen_card);
      chosen_card.m_pick_no = this.m_chosen_cards.length;
      return chosen_card;
    }

    cardsLeft(){
      const cards_left = this.m_cards.filter(card => !this.m_chosen_cards.includes(card));
      return cards_left;
    }
}

class Player {
  constructor(id, name, is_bot){
    this.m_id = id;
    this.m_name = name;
    this.m_is_bot = is_bot;
    this.m_drafted_cards = [];
  }

  pickCard(pack, id){
    const card = pack.chooseCardWithId(id);
    this.m_drafted_cards.push(card);
    card.m_owner_id = this.m_id;
  }
}

class DraftingSession {
  constructor(pack_size, no_packs, no_players){
    // config
    this.m_pack_size = pack_size;
    this.m_no_packs = no_packs;
    this.m_no_players = Math.min(no_players, MAX_NO_PLAYERS); // TODO@CONSIDER: separate logic and trigger log
    this.m_time_limit = 30;
    this.m_random_seed = 50292030;
    // dynamic
    this.m_players = [];
    this.m_card_pool = [];
    this.m_draft_pool = [];
    this.m_packs = [];
  }
  /**
   * @brief setup session, by organizing the card pool, draft pool,
   * players and packs
   */
  createSession() {
    this.loadCards();
    const min_no_cards = this.m_pack_size * this.m_no_packs * this.m_no_players;
    if (this.m_card_pool.length < min_no_cards){
      console.log('not enough cards in pool to start draft');
      return;
    }
    var shuffled_card_pool = seededShuffle(this.m_card_pool, this.m_random_seed);
    // slice shuffled pool to size
    this.m_draft_pool = shuffled_card_pool.slice(0, min_no_cards);
    
    this.m_packs = this.initializePacks(this.m_draft_pool);

    console.log(`session initialized`)
  }
  /**
   * @brief loads list of cards from file into card pool
   */
  loadCards() {
    const filename = "PauperCubeInitial_20231126.txt";
    const file = path.join("../local/", filename);
    if (!fs.existsSync(file)){
      console.error(`File: "${file} does not exist.`);
      return;
    }
    const data = fs.readFileSync(file, 'utf8');
    var card_id = 0;
    var data_str = '';
    data.split(/\r?\n/).forEach((data) => {
      data_str = data.toString();
      var card = new Card(card_id++, data_str);
      this.m_card_pool.push(card);
    });
  };

  addPlayer(player) {
    this.m_players.push(player);
  }

  /**
   * @brief initialize list of players, fill missing slots with bots
   */
  initializePlayers() {
    let no_bots = this.m_no_players - this.m_players.length;
    for (let i = 0; i < no_bots; i++) {
      const name = `Bot ${i + 1}`;
      const bot = new Player("NONE", name, true);
      this.m_players.push(bot);
    }
  }
  /**
   * @brief organize card pool into packs depending on the number of players
   * and pack size
   * @param card_pool
   * @returns packs
   */
  initializePacks(card_pool) {
    var idx = 0;
    const packs = [];
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

  simulateDraft() {
    this.initializePlayers();

    for (let round = 0; round < this.m_no_packs; round++) {
      // cut packs equal to no_players from all packs
      const packs_in_round = this.m_packs.slice(this.m_no_players * round,
        Math.min((this.m_no_players * (round+1)), this.m_packs.length));
      for (let pick_no = 0; pick_no < this.m_pack_size; pick_no++) {
        // loop through the players
        for (let player_idx = 0; player_idx < this.m_no_players; player_idx++) {
          const current_pack = packs_in_round[player_idx];
          const player = this.m_players[player_idx];
          // choose a card at random
          const available_picks = current_pack.cardsLeft();
          const random_idx = Math.floor(seedrandom(this.m_random_seed) * available_picks.length);
          const chosen_card = available_picks.at(random_idx-1);
          player.pickCard(current_pack, chosen_card.m_id_in_pack);
        }
        // shift packs around for the next round
        if (round % 2 === 0) {
          // clockwise
          packs_in_round.push(packs_in_round.shift());
        } else {
          // counter-clockwise
          packs_in_round.unshift(packs_in_round.pop());
        }
      }
      // check packs are empty
      if(packs_in_round.every(pack => pack.cardsLeft().length === 0)){
        console.log("all cards drafted from packs");
      }
    }
  }
}

// https://scryfall.com/docs/api/cards/search
const SCRYFALL_API = "https://api.scryfall.com/cards/named?fuzzy="
const MAX_REQ_PER_SEC = 10;
// {"object":"card","id":"5642cdda-789f-4125-a9ff-7c445bb51950","oracle_id":"a30907c0-fbde-4fd3-a8c7-f304305fcea7","multiverse_ids":[571342],"mtgo_id":101502,"tcgplayer_id":276249,"cardmarket_id":664021,"name":"Doomed Traveler","lang":"en","released_at":"2022-07-08","uri":"https://api.scryfall.com/cards/5642cdda-789f-4125-a9ff-7c445bb51950","scryfall_uri":"https://scryfall.com/card/2x2/9/doomed-traveler?utm_source=api","layout":"normal","highres_image":true,"image_status":"highres_scan","image_uris":{"small":"https://cards.scryfall.io/small/front/5/6/5642cdda-789f-4125-a9ff-7c445bb51950.jpg?1673146959","normal":"https://cards.scryfall.io/normal/front/5/6/5642cdda-789f-4125-a9ff-7c445bb51950.jpg?1673146959","large":"https://cards.scryfall.io/large/front/5/6/5642cdda-789f-4125-a9ff-7c445bb51950.jpg?1673146959","png":"https://cards.scryfall.io/png/front/5/6/5642cdda-789f-4125-a9ff-7c445bb51950.png?1673146959","art_crop":"https://cards.scryfall.io/art_crop/front/5/6/5642cdda-789f-4125-a9ff-7c445bb51950.jpg?1673146959","border_crop":"https://cards.scryfall.io/border_crop/front/5/6/5642cdda-789f-4125-a9ff-7c445bb51950.jpg?1673146959"},"mana_cost":"{W}","cmc":1.0,"type_line":"Creature — Human Soldier","oracle_text":"When Doomed Traveler dies, create a 1/1 white Spirit creature token with flying.","power":"1","toughness":"1","colors":["W"],"color_identity":["W"],"keywords":[],"all_parts":[{"object":"related_card","id":"5642cdda-789f-4125-a9ff-7c445bb51950","component":"combo_piece","name":"Doomed Traveler","type_line":"Creature — Human Soldier","uri":"https://api.scryfall.com/cards/5642cdda-789f-4125-a9ff-7c445bb51950"},{"object":"related_card","id":"7ebb3b03-943e-4b5a-be04-f59316b81333","component":"token","name":"Spirit","type_line":"Token Creature — Spirit","uri":"https://api.scryfall.com/cards/7ebb3b03-943e-4b5a-be04-f59316b81333"}],"legalities":{"standard":"not_legal","future":"not_legal","historic":"legal","gladiator":"legal","pioneer":"not_legal","explorer":"not_legal","modern":"legal","legacy":"legal","pauper":"legal","vintage":"legal","penny":"legal","commander":"legal","oathbreaker":"legal","brawl":"not_legal","historicbrawl":"legal","alchemy":"not_legal","paupercommander":"legal","duel":"legal","oldschool":"not_legal","premodern":"not_legal","predh":"not_legal"},"games":["paper","mtgo"],"reserved":false,"foil":true,"nonfoil":true,"finishes":["nonfoil","foil"],"oversized":false,"promo":false,"reprint":true,"variation":false,"set_id":"5a645837-b050-449f-ac90-1e7ccbf45031","set":"2x2","set_name":"Double Masters 2022","set_type":"masters","set_uri":"https://api.scryfall.com/sets/5a645837-b050-449f-ac90-1e7ccbf45031","set_search_uri":"https://api.scryfall.com/cards/search?order=set&q=e%3A2x2&unique=prints","scryfall_set_uri":"https://scryfall.com/sets/2x2?utm_source=api","rulings_uri":"https://api.scryfall.com/cards/5642cdda-789f-4125-a9ff-7c445bb51950/rulings","prints_search_uri":"https://api.scryfall.com/cards/search?order=released&q=oracleid%3Aa30907c0-fbde-4fd3-a8c7-f304305fcea7&unique=prints","collector_number":"9","digital":false,"rarity":"common","flavor_text":"He vowed he would never rest until he reached his destination. He doesn't know how right he was.","card_back_id":"0aeebaf5-8c7d-4636-9e82-8c27447861f7","artist":"Lars Grant-West","artist_ids":["21ed6499-c4d3-4965-ab02-6c7228275bec"],"illustration_id":"29d8819e-ae8a-451c-b59e-b062993d9535","border_color":"black","frame":"2015","full_art":false,"textless":false,"booster":true,"story_spotlight":false,"edhrec_rank":3372,"penny_rank":998,"preview":{"source":"Wizards of the Coast","source_uri":"https://magic.wizards.com/en/articles/archive/card-image-gallery/double-masters-2022","previewed_at":"2022-06-16"},"prices":{"usd":"0.02","usd_foil":"0.08","usd_etched":null,"eur":"0.02","eur_foil":"0.03","tix":"0.04"},"related_uris":{"gatherer":"https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=571342&printed=false","tcgplayer_infinite_articles":"https://tcgplayer.pxf.io/c/4931599/1830156/21018?subId1=api&trafcat=infinite&u=https%3A%2F%2Finfinite.tcgplayer.com%2Fsearch%3FcontentMode%3Darticle%26game%3Dmagic%26partner%3Dscryfall%26q%3DDoomed%2BTraveler","tcgplayer_infinite_decks":"https://tcgplayer.pxf.io/c/4931599/1830156/21018?subId1=api&trafcat=infinite&u=https%3A%2F%2Finfinite.tcgplayer.com%2Fsearch%3FcontentMode%3Ddeck%26game%3Dmagic%26partner%3Dscryfall%26q%3DDoomed%2BTraveler","edhrec":"https://edhrec.com/route/?cc=Doomed+Traveler"},"purchase_uris":{"tcgplayer":"https://tcgplayer.pxf.io/c/4931599/1830156/21018?subId1=api&u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F276249%3Fpage%3D1","cardmarket":"https://www.cardmarket.com/en/Magic/Products/Search?referrer=scryfall&searchString=Doomed+Traveler&utm_campaign=card_prices&utm_medium=text&utm_source=scryfall","cardhoarder":"https://www.cardhoarder.com/cards/101502?affiliate_id=scryfall&ref=card-profile&utm_campaign=affiliate&utm_medium=card&utm_source=scryfall"}}
function Scryfall(){
}

function Hello() {
  return true;
}

module.exports = {
  Hello : Hello,
  DraftingSession : DraftingSession,
  Player : Player,
}
