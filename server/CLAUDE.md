# Server — CLAUDE.md

## Tech Stack

Express 4, Socket.io 4, TypeScript (strict), CommonJS (`"type": "commonjs"`), Jest 29, seedrandom 3, Joi 18, jsonwebtoken 9.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | ts-node-dev with auto-reload on localhost:5000 |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled `dist/server.js` |
| `npm run test` | Jest (`jest --config jest.config.js`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

CI runs typecheck -> lint -> test.

## Source Structure (`src/`)

- `server.ts` — Express + Socket.io setup, CORS config, route/socket registration
- `api/session.ts` — REST endpoints: `POST /createSession`, `GET /cube`
- `sockets/lobby.ts` — WebSocket handlers for lobby lifecycle (join, ready, kick, reorder, start, disconnect)
- `sockets/draft.ts` — **Stub**: draft gameplay socket handlers (empty)
- `state/sessions.ts` — In-memory session store, `LobbySession` interface, helper functions for player management and state broadcasting
- `state/draft.ts` — **Stub**: draft-phase state (empty)
- `game/game.ts` — Core domain classes: `Card`, `Pack`, `Player`, `DraftingSession`
- `game/game.test.ts` — Jest test: simulates a full draft setup

## Game Architecture

Four core classes in `game/game.ts`, all using `m_` prefix for instance fields:

- **`Card`** (`:9`) — `m_id`, `m_name`, `m_owner_id`, `m_pack_id`, `m_id_in_pack`, `m_pick_no`
- **`Pack`** (`:21`) — `m_cards`, `m_chosen_cards`; methods: `addCard`, `chooseCardWithId`, `cardsLeft`, `isEmpty`
- **`Player`** (`:49`) — `m_id` (socket ID or null), `m_name`, `m_is_bot`, `m_drafted_cards`, `m_ready`, `m_isOwner`; method: `pickCard`
- **`DraftingSession`** (`:76`) — manages card pool, packs, draft rounds; methods: `loadCards`, `createSession`, `startDraft`, `advancePick`, `advanceRound`, `assignInitialPacks`

## State Layer

- `LobbySession` interface (`state/sessions.ts:4`) extends `DraftingSession` adding `m_kickedPlayers`, `m_disconnectTimeouts`, `m_started`
- Instances created via `Object.assign` on a `DraftingSession` (`api/session.ts:29-33`)
- All sessions stored in `sessions: Record<string, LobbySession>` (`state/sessions.ts:10`)
- `emitSessionState` (`state/sessions.ts:25`) broadcasts `{ session_id, owner, players, canStart }` to the room

## Key Behaviors

- **Session creation**: pre-fills 7 bot slots, max 8 players (`api/session.ts:20-27`)
- **Bot substitution**: humans replace bots on join; kicked/timed-out humans become bots
- **Disconnect grace period**: 30s timeout before bot replacement (`sockets/lobby.ts:5`, `:69-82`)
- **Ownership transfer**: auto-transfers to next connected non-bot on owner disconnect (`state/sessions.ts:20-23`)
- **Kick**: owner-only, target becomes a bot, target socket gets `sessionError` + disconnect (`state/sessions.ts:148-168`)
- **Seeded shuffling**: deterministic via `seedrandom`, hardcoded seed (`game/game.ts:102`, `:265-275`)
- **Pack rotation**: left on even rounds, right on odd (`game/game.ts:235-248`)
- **Empty session cleanup**: sessions deleted when no connected humans remain and draft hasn't started (`state/sessions.ts:118-127`)

## Placeholders

- `game/game.ts:317-320` — Scryfall API constant + empty `Scryfall()` function for future card image fetching
