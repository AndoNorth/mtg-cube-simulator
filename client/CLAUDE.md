# Client — CLAUDE.md

## Tech Stack

React 18, Vite 7, TypeScript (strict), React Bootstrap 2, Socket.io client 4. ES modules (`"type": "module"`).

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server on localhost:5173 |
| `npm run build` | Production build |
| `npm run lint` | ESLint (zero warnings enforced via `--max-warnings 0`) |
| `npm run typecheck` | `tsc --noEmit` |

No tests currently. CI runs typecheck -> lint.

## Source Structure (`src/`)

- `main.tsx` — React entry point
- `App.tsx` — React Router v6: `/` -> Home, `/draft` -> Draft
- `Pages/Navigation.tsx` — Navbar with route links (functional component)
- `Pages/Home/Home.tsx` — Card list viewer, mostly scaffold/placeholder
- `Pages/Home/AddModal.tsx` — "Add Video" modal, leftover scaffold unrelated to MTG
- `Pages/Draft/Draft.tsx` — Main draft page: Socket.io connection, session join/leave, lobby state management (class component)
- `Pages/Draft/Lobby.tsx` — Player list, ready/kick/reorder controls (functional component)
- `types/session.ts` — `SessionState` and `SessionPlayer` interfaces matching server broadcast shape

## Conventions

- **Page containers**: class components with explicit state interfaces (`Draft.tsx:22`, `Home.tsx:12`)
- **Presentational components**: functional components (`Lobby.tsx:19`, `Navigation.tsx:4`)
- Backend URL sourced from `import.meta.env.VITE_BACKEND_API`

## Session Persistence

localStorage keys used in `Draft.tsx:30-32`:
- `player_name` — remembered across sessions
- `session_id` — auto-rejoin on page reload
- `token` — authentication token from server

## Socket Events Emitted

`authenticate`, `joinSession`, `ready`, `leaveSession`, `kickPlayer`, `reorderPlayer`, `startDraft` — all in `Draft.tsx:65-181`

## Socket Events Listened

`connect`, `authenticated`, `sessionState`, `sessionError`, `disconnect` — all in `Draft.tsx:71-118`
