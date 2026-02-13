# CLAUDE.md

## Project Overview

MTG Cube Simulator — a real-time multiplayer Magic: The Gathering cube draft web app. Monorepo with independent `client/` and `server/` packages communicating via Socket.io WebSockets.

## Monorepo Structure

```
client/              React 18 / Vite 7 SPA (ES modules, :5173)
server/              Express 4 / Socket.io API (CommonJS, :5000)
local/               Cube card list data file
.github/workflows/   CI pipeline (Node 20)
```

Each package has its own `CLAUDE.md` with package-specific commands, structure, and conventions.

## Communication Protocol

- **REST**: `POST /createSession`, `GET /cube`
- **WebSocket events**: `joinSession`, `ready`, `leaveSession`, `kickPlayer`, `reorderPlayer`, `startDraft`, `pickCard`, `disconnect`
- Server broadcasts `sessionState` to all players in a room after every state mutation
- Server emits per-player `draftState` during draft phase (round/pick info, available cards, picked cards)

## CI Pipeline

Runs on push/PR to `main` (`.github/workflows/ci.yaml`):
- Client job: typecheck -> lint
- Server job: typecheck -> lint -> test

## Environment

- Client `.env`: `VITE_BACKEND_API=http://localhost:5000/`
- Server: `PORT` env var (default 5000), CORS allows `http://localhost:5173`

## Data

Cube card list: `local/PauperCubeInitial_20231126.txt` (one card name per line). Server reads it relative to its source: `../local/PauperCubeInitial_20231126.txt`.

## Additional Documentation

- `.claude/docs/architectural_patterns.md` — cross-cutting architectural patterns, state management, socket event conventions, naming conventions
