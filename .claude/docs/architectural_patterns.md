# Architectural Patterns

Patterns observed across multiple files in this codebase.

## 1. Socket Event Pattern: Fetch -> Validate -> Mutate -> Broadcast

Every socket handler in `server/src/sockets/lobby.ts` follows the same four-step pattern:

1. **Fetch** session via `getSession(session_id)` (`server/src/state/sessions.ts:12`)
2. **Validate** the session exists (and caller has permission)
3. **Mutate** state via a helper function from `server/src/state/sessions.ts`
4. **Broadcast** updated state via `emitSessionState(io, session_id)` (`server/src/state/sessions.ts:25`)

See any handler in `server/src/sockets/lobby.ts:9-86` for examples.

## 2. `m_` Member Prefix Convention

All class instance fields use an `m_` prefix (e.g., `m_players`, `m_card_pool`, `m_ready`, `m_is_bot`). This applies across all game domain classes:

- `Card` — `server/src/game/game.ts:9-18`
- `Pack` — `server/src/game/game.ts:21-47`
- `Player` — `server/src/game/game.ts:49-70`
- `DraftingSession` — `server/src/game/game.ts:76-311`
- `LobbySession` interface — `server/src/state/sessions.ts:4-8`

## 3. In-Memory State with Centralized Store

All session state lives in a single `sessions` record (`server/src/state/sessions.ts:10`). No database. State is mutated through dedicated helper functions exported from the same module, not directly by socket handlers.

Key helpers: `addPlayerToSession`, `removePlayerFromSession`, `toggleReady`, `reorderPlayer`, `kickPlayer`, `startDraft`, `markPlayerDisconnected`.

## 4. Composition via Object.assign for LobbySession

`LobbySession` is an interface extending `DraftingSession` (`server/src/state/sessions.ts:4`), but instances are created by constructing a `DraftingSession` and using `Object.assign` to mix in the additional lobby fields (`server/src/api/session.ts:29-33`). This avoids class inheritance while adding `m_kickedPlayers`, `m_disconnectTimeouts`, and `m_started`.

## 5. Bot Substitution Pattern

Bots serve as placeholder slots. When a human joins, they replace a bot (`server/src/state/sessions.ts:72-91`). When a human is kicked or disconnects past the grace period, they become a bot (`server/src/state/sessions.ts:148-167`, `server/src/state/sessions.ts:176-193`). Sessions start pre-filled with 7 bots (`server/src/api/session.ts:23-27`).

## 6. Disconnect Grace Period

When a socket disconnects, a 30-second timeout starts (`server/src/sockets/lobby.ts:69-82`). The countdown is broadcast to all clients as seconds remaining in `emitSessionState` (`server/src/state/sessions.ts:36-37`). If the player reconnects, the timer is cleared (`server/src/state/sessions.ts:62-66`). If it expires, `markPlayerDisconnected` converts them to a bot.

## 7. Ownership Transfer

When the session owner disconnects or leaves, ownership transfers to the next connected non-bot player (`server/src/state/sessions.ts:20-23`). This is called from `removePlayerFromSession` and `markPlayerDisconnected`.

## 8. Client Component Conventions

- **Page containers** use class components with explicit state interfaces (e.g., `client/src/Pages/Draft/Draft.tsx:22`, `client/src/Pages/Home/Home.tsx:12`)
- **Presentational components** use functional components (e.g., `client/src/Pages/Draft/Lobby.tsx:19`, `client/src/Pages/Navigation.tsx:4`)
- Session persistence uses localStorage keys: `player_name`, `session_id`, `token` (`client/src/Pages/Draft/Draft.tsx:30-32`)

## 9. Seeded Shuffling

Card pool shuffling uses `seedrandom` for deterministic RNG (`server/src/game/game.ts:265-275`). The seed is a hardcoded constant (`server/src/game/game.ts:102`). This ensures consistent shuffles for testing/debugging.

## 10. Pack Rotation Direction

Packs rotate left on even rounds, right on odd rounds (`server/src/game/game.ts:235-248`), mirroring real MTG draft convention.
