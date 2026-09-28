# 02 — Architecture

## From "PC as local server" to "cloud server, PC as screen"

The original idea was for the PC to act as a local server. A browser **cannot open a server** that phones
connect to; that would require installing an app (Node/Electron) on the PC, everyone on the same Wi-Fi,
and dealing with firewalls, local IPs and HTTPS without certificates.

Since the goal is to have it **always available in the cloud** (AirConsole model):

- The **server lives in the cloud** and owns the room and the battle.
- The **PC is only the screen (Host)**: it opens the web app, creates the room and renders.
- **Phones** connect to the same room via WebSocket.

Benefits: nothing to install, works on any network, real HTTPS (needed for Wake Lock, PWA, etc.).
Cost: every device needs internet (fine), and a backend process must run. See
`07-hosting-and-deployment.md` for how to do this at **$0**, including a future "Host-authoritative" option
where the simulator runs in the PC browser (closer to the original idea).

## Overview

```
┌──────────────────────── Frontend (static, Vercel/Cloudflare, free) ─────────────────────────┐
│  SPA: /host (screen)   /j/:code (controller)   + compact dex JSON + locale tables + sprites  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
          │ loads SPA                                              │ loads SPA
┌─────────▼──────────┐                                  ┌──────────▼─────────────┐
│ PC / TV — Host     │                                  │ Phones — Controllers   │
│ lobby, QR, battle  │                                  │ join, team builder,    │
│ scene (spectator)  │                                  │ private battle actions │
└─────────┬──────────┘                                  └──────────┬─────────────┘
          │ WSS: public state + spectator log                       │ WSS: filtered state + private request
┌─────────▼─────────────────────── Backend (Node, Render free) ────▼─────────────────────────┐
│  apps/server: Fastify (healthz, wake-up) + Socket.IO (auth by token, zod validation)        │
│      │                                                                                       │
│      ▼                                                                                       │
│  packages/core (pure TS, no IO)                                                              │
│   ├─ RoomManager / Room — state machine LOBBY…RESULTS, players, seats, teams, locale        │
│   ├─ TeamService — random sets, validation (TeamValidator), import/export                   │
│   ├─ BattleAdapter — pokemon-showdown BattleStream + player streams + instance patches      │
│   └─ OwnershipLayer — humans ↔ Pokémon/positions, request splitting, choice merging         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Simulator integration

The `pokemon-showdown` package exposes `BattleStream` and `getPlayerStreams()`, which splits the flow into:

| Stream       | Content                                          | Destination in Poke-Air                   |
| ------------ | ------------------------------------------------ | ----------------------------------------- |
| `omniscient` | Everything, including hidden info                | Server only (logs/debug/replays/recovery) |
| `spectator`  | What a spectator would see                       | **Host** (battle scene)                   |
| `p1`, `p2`   | Log + `\|request\|` JSON with the side's options | **OwnershipLayer** → owning phone(s)      |

Turn flow:

```
Sim ──|request| p1──► OwnershipLayer ──battle:request (filtered)──► Phone A
                                     └─battle:request (filtered)──► Phone B (same side)
Phone A ──battle:choose {pos:0, "move 2 1 mega"}──► Server validates owner/option
Phone B ──battle:choose {pos:1, "switch 5"}───────► Server merges ──► `>p1 move 2 1 mega, switch 5` ──► Sim
Sim ──spectator log──► Host ──(animates)──► host:turnAnimated ──► Server releases next request to phones
```

- Start: `>start {"formatid": "<ruleset format>"}` + `>player p1 {"name": "...", "team": "<packed>"}`.
- **Animation sync:** the sim resolves a turn instantly, but phones shouldn't show the next menu while the
  Host is still animating. The Host sends `host:turnAnimated`; the server waits for it with a **timeout**
  (e.g. 15 s) so a slow/disconnected Host never blocks the game.
- **Turn timer** (configurable); on expiry, the missing part of the choice is auto-completed (`default`).
- On the Host, `@pkmn/protocol` parses the log and **our own lightweight reducer** (`HostBattleModel`)
  keeps the displayed state (HP, status, boosts, field, Mega) and produces an **event queue** to animate
  (`|move|`, `|-damage|`, `|switch|`, `|-mega|`, `|faint|`…). We don't use `@pkmn/client`: it needs a
  `@pkmn/dex` generation, and `@pkmn/dex` doesn't include the Champions mod (new Megas would be unknown).
  The Host only needs what the protocol lines already carry (species/details, HP, status).
- **Deterministic recovery:** Showdown battles are deterministic given the PRNG seed + input log. The
  server keeps both, so a battle can be rebuilt after a crash, and the Host can rebuild the scene from the
  full spectator log after a refresh.

## Event protocol

**Source of truth: `packages/shared/src/events.ts` (types) + `packages/shared/src/schemas.ts` (zod).**
The tables below summarize it; if they disagree with the code, the code wins — update this doc.

Conventions:

- Two Socket.IO **namespaces**, one per role: `/host` and `/player`. A phone socket can never emit host events.
- Names are `domain:action`. Every client → server event is `(payload, ack)`; the server validates the
  payload with zod and **always acks** a `Result`: `{ ok: true, ...data }` or `{ ok: false, error: { code, params? } }`.
- Error `code`s are translated on the client (`errors.<code>` i18n key). The server never sends prose.
- After every successful mutation the server broadcasts the full public snapshot `room:state` to the room
  (Host + phones). Private data goes through dedicated events to one socket only.

### Implemented (Phase 0)

| Namespace | Event (client → server)  | Payload                                              | Ack data                             |
| --------- | ------------------------ | ---------------------------------------------------- | ------------------------------------ |
| `/host`   | `host:createRoom`        | `{ locale? }`                                        | `{ code, hostToken, room }`          |
| `/host`   | `host:resumeRoom`        | `{ code, hostToken }`                                | `{ code, hostToken, room }`          |
| `/host`   | `host:setFormat`         | `{ gameType: 'singles' \| 'doubles' }`               | —                                    |
| `/host`   | `host:setLocale`         | `{ locale }`                                         | —                                    |
| `/host`   | `host:kick`              | `{ playerId }`                                       | —                                    |
| `/host`   | `host:startTeamBuilding` | `{}`                                                 | —                                    |
| `/host`   | `host:backToLobby`       | `{}`                                                 | —                                    |
| `/player` | `player:join`            | `{ code, name, avatar, playerId?, reconnectToken? }` | `{ playerId, reconnectToken, room }` |
| `/player` | `player:update`          | `{ name?, avatar? }`                                 | —                                    |
| `/player` | `player:switchTeam`      | `{ team: 'red' \| 'blue' }`                          | —                                    |
| `/player` | `player:leave`           | `{}`                                                 | —                                    |

| Namespace | Event (server → client) | Payload                                  |
| --------- | ----------------------- | ---------------------------------------- |
| both      | `room:state`            | `PublicRoomState` (see `room-state.ts`)  |
| `/player` | `player:removed`        | `'kicked' \| 'replaced' \| 'roomClosed'` |

`player:join` with a valid `playerId` + `reconnectToken` **rejoins** the existing seat (any phase);
otherwise it creates a new player (LOBBY only). A newer socket for the same seat replaces the older one
(`player:removed: 'replaced'`).

### Planned (Phase 1+) — see `docs/11-phase-1-plan.md` for exact payloads

| Namespace | Event                            | Direction | Purpose                                                        |
| --------- | -------------------------------- | --------- | -------------------------------------------------------------- |
| `/player` | `team:randomize`                 | c → s     | Fill/reroll slots with random Champions sets                   |
| `/player` | `team:setSlot`                   | c → s     | Set or remove (`null`) one slot (editor in Phase 2)            |
| `/player` | `team:import`                    | c → s     | Showdown text paste (Phase 2)                                  |
| `/player` | `player:ready`                   | c → s     | Toggle ready                                                   |
| `/player` | `team:state`                     | s → c     | Owner-only: own slots, quota, validation errors                |
| `/player` | `battle:request`                 | s → c     | Owner-only: filtered Showdown request                          |
| `/player` | `battle:choose`                  | c → s     | Choice for the player's position(s)                            |
| `/player` | `battle:undo` / `battle:forfeit` | c → s     | Undo current choice / forfeit                                  |
| `/host`   | `battle:log`                     | s → c     | Spectator protocol lines, append-only with index (resume-safe) |
| `/host`   | `host:turnAnimated`              | c → s     | Host finished animating turn N (releases next requests)        |
| both      | `battle:waiting`                 | s → c     | Who still has to choose + timer deadline                       |
| both      | `battle:end`                     | s → c     | Winner + summary                                               |
| `/host`   | `host:rematch`                   | c → s     | RESULTS → TEAM_BUILDING keeping teams                          |

## Identity, sessions and reconnection

- No accounts. On join the server returns `playerId` + `reconnectToken`; the phone stores them in
  `localStorage` (per room code) and uses them to reconnect.
- The Host stores `hostToken` in `sessionStorage` to recover the room after a refresh.
- Socket.IO provides automatic reconnection; phones also use the **Wake Lock API** and
  `visibilitychange` to reconnect when returning to the app.
- State is in memory. If the backend restarts/sleeps, rooms are lost (acceptable for casual play; the
  free host only sleeps after 15 min without traffic, i.e. when nobody is playing).

## Team builder data

Full dex data (species, learnsets, items, abilities) weighs several MB. Strategy:

1. `packages/data` generates **compact JSON per ruleset** at build time from the `pokemon-showdown` dex
   (`Dex.mod('champions')`): legal species, learnsets, items, abilities, natures, plus locale tables
   (see `06-i18n.md`).
2. Served as hashed static files with **aggressive caching** from the frontend host (service worker if PWA).
3. The phone loads them when entering TEAM_BUILDING → instant local search.
4. **Final validation** always happens on the server with `TeamValidator`.

## Stack

| Layer                | Choice                                     | Why                                                                                                                                                              |
| -------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language             | **TypeScript** (strict)                    | Showdown and @pkmn are TS; shared types server↔web                                                                                                               |
| Monorepo             | **pnpm workspaces** (+ Turborepo optional) | apps/server, apps/web, packages/core, shared, data                                                                                                               |
| Server runtime       | **Node.js ≥ 22.22** (`.nvmrc`)             | Showdown's sim is Node-first; Vitest 5 and React Router 8 require Node 22+                                                                                       |
| HTTP                 | **Fastify**                                | Lightweight; health check / wake-up endpoint                                                                                                                     |
| Realtime             | **Socket.IO**                              | Rooms, reconnection, acks; enough for one instance. Alternative: Colyseus (room framework), but its state sync adds little since battle state comes from the sim |
| Simulator            | **`pokemon-showdown`** (official npm)      | Only package that currently ships the **Champions mod** (`@pkmn/sim` lags behind — see `03`)                                                                     |
| Random sets          | `pokemon-showdown` random team generators  | `[Gen 9 Champions] Random Battle` sets (the npm release has no Champions _Random Doubles_ yet — see `05`)                                                        |
| Validation           | **zod**                                    | Shared event schemas                                                                                                                                             |
| Frontend             | **Vite + React + TS**                      | One SPA with `/host` and `/j/:code` routes                                                                                                                       |
| UI state             | **Zustand**                                | Simple, sufficient                                                                                                                                               |
| Styling              | **Tailwind CSS**                           | Fast mobile-first UI and Host stage                                                                                                                              |
| Animation            | **CSS / Web Animations API + Motion**      | Showdown sprites are animated GIFs → DOM is the natural fit. PixiJS only if particle effects are needed                                                          |
| Battle model on Host | **@pkmn/protocol** + own reducer           | Parse the spectator log; `@pkmn/client` not used (its dex lacks the Champions mod)                                                                               |
| Sprite URLs          | **@pkmn/img** (with our own `domain`)      | Resolves sprite paths/fallbacks; files are self-hosted by `pnpm fetch:sprites`                                                                                   |
| i18n                 | **i18next + react-i18next**                | Namespaces, interpolation, lazy-loaded locales                                                                                                                   |
| QR                   | **qrcode.react**                           |                                                                                                                                                                  |
| Tests                | **Vitest**, **Playwright**                 | Playwright with several contexts simulates 1 Host + N phones                                                                                                     |
| Logging              | **pino**                                   |                                                                                                                                                                  |

## Repo layout

Current tree (✅ exists, 🔜 planned):

```
poke-air/
├─ apps/
│  ├─ server/src/
│  │  ├─ index.ts                 ✅ entry: listen + graceful shutdown
│  │  ├─ app.ts                   ✅ buildApp(): Fastify + Socket.IO + sweep timer (testable, no listen)
│  │  ├─ config.ts                ✅ env → Config
│  │  ├─ app.test.ts              ✅ realtime integration tests (socket.io-client)
│  │  └─ transport/
│  │     ├─ realtime.ts           ✅ namespaces, broadcast(), seat → socket maps
│  │     ├─ with-validation.ts    ✅ zod validation + Result ack + RoomError mapping
│  │     ├─ host-handlers.ts      ✅ /host events
│  │     ├─ player-handlers.ts    ✅ /player events
│  │     └─ battle-handlers.ts    🔜 Phase 1
│  └─ web/src/
│     ├─ main.tsx                 ✅ router, lazy routes per face
│     ├─ home/                    ✅ landing (host / join by code)
│     ├─ host/                    ✅ HostScreen, HostLobby, TeamColumn, host-store
│     │  └─ battle-scene/         🔜 Phase 1: stage, sprites, HP bars, animation queue, HostBattleModel
│     ├─ controller/              ✅ ControllerScreen, JoinForm, ControllerLobby, controller-store
│     │  ├─ team-builder/         🔜 Phase 1
│     │  └─ battle/               🔜 Phase 1
│     ├─ components/              ✅ Stage (1920×1080), TrainerSprite
│     ├─ i18n/                    ✅ i18next setup, typed keys, locales/en/ui.json
│     └─ lib/                     ✅ backend URL/QR URL, sockets, storage, wake lock, room locale
├─ packages/
│  ├─ shared/src/                 ✅ constants, avatars, errors, room-state, schemas (zod), events
│  ├─ core/src/
│  │  ├─ rooms/                   ✅ Room, RoomManager, composition, room codes, RoomError (+ tests)
│  │  ├─ battle/showdown.ts       ✅ the ONLY import point for pokemon-showdown (+ smoke tests)
│  │  ├─ team/                    🔜 Phase 1: TeamService (randomizer, quotas, validation)
│  │  └─ battle/                  🔜 Phase 1: BattleSession, OwnershipLayer, TurnTimer
│  └─ data/scripts/               ✅ fetch-sprites.ts (trainers) · 🔜 Pokémon sprites, compact dex, locales
└─ docs/
```

## Basic security

- 4-letter room codes (24-letter alphabet without I/O → ~331k combinations). 🔜 Rate limiting on
  `player:join` per IP (Phase 1 hardening).
- Max 4 players per room in v1 (2 per team). 🔜 Max rooms per IP.
- The server never trusts clients: validates ownership of every position, choices against the current
  `request`, and teams with `TeamValidator`.
- No passwords or accounts (AirConsole-style): the room code is the only key. Rooms are ephemeral and
  the Host can kick unwanted players.
