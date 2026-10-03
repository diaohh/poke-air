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
Sim ──spectator log──► Host ──(animates)──► host:animated {upTo} ──► Server releases next request to phones
```

- Start (implemented in `core/battle/battle-session.ts`): Poke-Air drives Showdown's `Battle` class directly
  (what `BattleStream` wraps) with a synchronous `send` callback, so every call returns with its log chunk and
  requests already delivered and `choose()` knows at once if the sim accepted the choice. Right after
  `>start` the instance is patched (`reportExactHP = false`, `debugMode = false`): Champions custom games
  are debug formats that would show spectators exact HP and damage rolls. Then both players are added.
- **Animation sync** (core `MatchController`): the sim resolves a turn instantly, but phones shouldn't
  show the next menu while the Host is still animating. Each request remembers the spectator log length
  when it arrived; it is released to the phone once the Host reports `host:animated { upTo }` past that
  point, after **15 s** anyway, or at once if the Host is offline. Meanwhile phones get
  `battle:request { request: null }` ("look at the big screen"). The move to RESULTS waits the same way.
- **Turn timer** (60 s per decision in singles, 90 s in doubles, from the moment the menu is released); on
  expiry the missing parts are auto-completed with automatic actions per position (never Mega Evolves),
  keeping what teammates already chose.
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

### Implemented (Phase 0 → Phase 3)

| Namespace | Event (client → server)  | Payload                                                                                                                                | Ack data                             |
| --------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `/host`   | `host:createRoom`        | `{ locale? }`                                                                                                                          | `{ code, hostToken, room }`          |
| `/host`   | `host:resumeRoom`        | `{ code, hostToken }`                                                                                                                  | `{ code, hostToken, room }`          |
| `/host`   | `host:setFormat`         | `{ gameType: 'singles' \| 'doubles' }`                                                                                                 | —                                    |
| `/host`   | `host:setLocale`         | `{ locale }`                                                                                                                           | —                                    |
| `/host`   | `host:kick`              | `{ playerId }`                                                                                                                         | —                                    |
| `/host`   | `host:startTeamBuilding` | `{}`                                                                                                                                   | —                                    |
| `/host`   | `host:backToLobby`       | `{}` (TEAM_BUILDING or RESULTS)                                                                                                        | —                                    |
| `/host`   | `host:animated`          | `{ upTo }` — log lines the scene has shown                                                                                             | —                                    |
| `/host`   | `host:rematch`           | `{}` (RESULTS → TEAM_BUILDING, teams kept)                                                                                             | —                                    |
| `/host`   | `host:closeRoom`         | `{}` — ends the room: phones get `player:removed: roomClosed` (D-57)                                                                   | —                                    |
| `/player` | `player:join`            | `{ code, name, avatar, playerId?, reconnectToken? }`                                                                                   | `{ playerId, reconnectToken, room }` |
| `/player` | `player:update`          | `{ name?, avatar? }`                                                                                                                   | —                                    |
| `/player` | `player:switchTeam`      | `{ team: 'red' \| 'blue' }`                                                                                                            | —                                    |
| `/player` | `player:leave`           | `{}`                                                                                                                                   | —                                    |
| `/player` | `player:ready`           | `{ ready }` (needs `team:state.minimum` Pokémon: 1, or 2 for a solo doubles player)                                                    | —                                    |
| `/player` | `team:randomize`         | `{ slots? }` — no slots = whole team                                                                                                   | —                                    |
| `/player` | `team:setSlot`           | `{ slot, set }` — edited set (validated) or `null` = remove                                                                            | —                                    |
| `/player` | `team:import`            | `{ text }` — Showdown team text, replaces the team                                                                                     | `{ count, skipped }`                 |
| `/player` | `builder:validateSet`    | `{ set }` — no seat needed (D-51): validate one set                                                                                    | `{ set }` (normalized)               |
| `/player` | `builder:randomSet`      | `{ species?, exclude? }` — a set for `species` (D-52) or a random Pokémon                                                              | `{ set }`                            |
| `/player` | `builder:parseTeam`      | `{ text }` — parse + validate Showdown text, nothing stored                                                                            | `{ sets }`                           |
| `/player` | `battle:choose`          | `{ choice, rqid? }` — one action per position the player decides, comma-separated: `move N [target] [mega]` · `switch N`; or `default` | —                                    |
| `/player` | `battle:undo`            | `{}`                                                                                                                                   | —                                    |
| `/player` | `battle:forfeit`         | `{}`                                                                                                                                   | —                                    |

| Namespace | Event (server → client) | Payload                                                                                                                                                                                                                                                                                                                            |
| --------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| both      | `room:state`            | `PublicRoomState` (ready flags, team counts, countdown, result — no species)                                                                                                                                                                                                                                                       |
| `/player` | `player:removed`        | `'kicked' \| 'replaced' \| 'roomClosed'`                                                                                                                                                                                                                                                                                           |
| `/player` | `team:state`            | Owner only: `{ quota, minimum, slots }`                                                                                                                                                                                                                                                                                            |
| `/player` | `battle:request`        | Owner only: `{ request: BattleRequest \| null, choice }` (`null` = watch the screen). The OwnershipLayer's share (D-43): the player's positions (`active` / `forceSwitch` with `position` + `pokemon`), own Pokémon only (with `slot`, stats, nature, stat stages, item icon), public `field` for targets, `megasLeft`, `allyMega` |
| `/host`   | `battle:log`            | `{ from, lines, moves, effects, resync? }` — public spectator lines, append-only; `effects` = dex durations of the timed effects started in `lines`                                                                                                                                                                                |
| both      | `battle:waiting`        | `{ waitingFor: playerId[], timerMs }`                                                                                                                                                                                                                                                                                              |

`player:join` with a valid `playerId` + `reconnectToken` **rejoins** the existing seat (any phase);
otherwise it creates a new player (LOBBY only). A newer socket for the same seat replaces the older one
(`player:removed: 'replaced'`). After (re)attaching, a phone gets its `team:state` and, mid-battle, its
current `battle:request`; a Host gets the whole log with `resync: true` and rebuilds the scene without
animating the past. Battle choices are rejected through the ack (`INVALID_CHOICE`, `STALE_REQUEST`,
`ALREADY_CHOSEN`, `NO_PENDING_REQUEST`…); the result lives in `room:state.result` (no `battle:end` event).
Team edits (`team:setSlot` with a set, `team:import`) are validated with Showdown's `TeamValidator`
(`INVALID_SET`, with the validator's English lines in `params.details`, decision D-38) and Species Clause
across the whole side (`SPECIES_CLAUSE { species }`); unreadable text is `INVALID_IMPORT`.
Phase 3 adds `TEAM_TOO_SMALL { min }` (doubles side under 2 Pokémon, D-44) and `MEGA_TAKEN` (a teammate
already Mega Evolves this turn, D-45). When a teammate's part changes, the server re-sends the player's
`battle:request` (same `rqid`) so the Mega lock (`allyMega`) stays current.

### Planned

No protocol changes are planned for Phase 4 (i18n happens on the clients, keyed by Showdown ids).

## Identity, sessions and reconnection

- No accounts. On join the server returns `playerId` + `reconnectToken`; the phone stores them in
  `localStorage` (per room code) and uses them to reconnect.
- The Host stores `hostToken` in `sessionStorage` to recover the room after a refresh.
- Socket.IO provides automatic reconnection; phones also use the **Wake Lock API** and
  `visibilitychange` to reconnect when returning to the app.
- State is in memory. If the backend restarts/sleeps, rooms are lost (acceptable for casual play; the
  free host only sleeps after 15 min without traffic, i.e. when nobody is playing).

## Team builder data

Full dex data (species, learnsets, items, abilities) weighs several MB. Strategy (decision D-36):

1. ✅ `pnpm build:data` (`packages/data/scripts/build-dex.ts` → core `buildTeamBuilderData()`) generates
   **compact JSON for the Casual ruleset** from the `pokemon-showdown` dex: 1234 legal species (types, base
   stats, abilities, learnset as move indexes, Mega Stones), 827 moves, 363 items, ability descriptions,
   natures (~830 KB, **~157 KB gzip**, ≈ 9 s). Written to `apps/web/public/data/teambuilder.json`
   (git-ignored); `pnpm dev` and `pnpm build` run it first and it skips when its stamp (Showdown version +
   generator version) is current.
2. Served as a static file by the frontend host (🔜 hashed name / service-worker cache with the PWA).
3. The phone loads it when entering TEAM_BUILDING (`lib/team-dex.ts`, one fetch per page) → instant local
   search. Locale tables arrive with Phase 4 (see `06-i18n.md`).
4. **Final validation** always happens on the server with `TeamValidator` (decision D-35).

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
| Styling              | **Tailwind CSS 4 + Sass (SCSS)**           | Tailwind for layout/typography; SCSS partials for design-system components (see `10-development.md` § Styles)                                                    |
| Animation            | **CSS / Web Animations API + Motion**      | Showdown sprites are animated GIFs → DOM is the natural fit. PixiJS only if particle effects are needed                                                          |
| Battle model on Host | **@pkmn/protocol** + own reducer           | Parse the spectator log; `@pkmn/client` not used (its dex lacks the Champions mod)                                                                               |
| Sprite URLs          | **@pkmn/img** (download time only)         | `pnpm fetch:sprites` resolves paths/fallbacks and writes `sprites/pokemon-manifest.json`; the web reads the manifest (files self-hosted)                         |
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
│  │     ├─ builder-handlers.ts   ✅ stateless builder:* events (no seat, rate-limited)
│  │     ├─ battle-handlers.ts    ✅ battle events → core MatchController
│  │     └─ rate-limit.ts         ✅ token bucket (joins, rooms per IP)
│  └─ web/src/
│     ├─ main.tsx                 ✅ router, lazy routes per face
│     ├─ index.css                ✅ Tailwind entry + design tokens (@theme static)
│     ├─ styles/                  ✅ SCSS: abstracts, base, components, screens (main.scss entry)
│     ├─ home/                    ✅ landing (host / join by code) + HeroScene illustration
│     ├─ host/                    ✅ HostScreen, HostHeader, HostLobby, JoinPanel, TeamPanel, PlayerCard,
│     │                              HostTeamBuilding (countdown), HostResults, SoundMenu, host-store
│     │  ├─ audio/                ✅ ZzFX sounds + event mapping, music, cries, settings store
│     │  └─ battle-scene/         ✅ model (HostBattleModel reducer), playback (animation queue), HostBattle,
│     │                              SideCard, ActiveSlot, BattleLog, NarrationText
│     ├─ teams/                   ✅ standalone team builder `/teams` (TeamsScreen, TeamDraft, store)
│     ├─ controller/              ✅ ControllerScreen, JoinForm, ControllerLobby, ControllerResults, store
│     │  ├─ team-builder/         ✅ TeamBuilder (list, randomizer, ready), PokemonEditor, Picker,
│     │  │                           StatPointsEditor, TeamMenu (import / export / saved teams)
│     │  └─ battle/               ✅ ControllerBattle (menu/fight/party/waiting), sheets, TurnTimerChip
│     ├─ components/              ✅ Stage (1920×1080), TrainerSprite, PokemonSprite, LanguageSelect
│     │  ├─ ItemIcon.tsx          ✅ item icon from the self-hosted sheet (D-42)
│     │  └─ ui/                   ✅ design-system primitives: Button, IconButton, Icon, PokeBall,
│     │                              StatusPill, TeamChip, HpBar, Logo, CodeChip, Sheet
│     ├─ i18n/                    ✅ i18next setup, typed keys, locales/en + es-ES/ui.json
│     └─ lib/                     ✅ backend URL/QR URL, sockets, storage, wake lock, room locale, cn, team,
│                                    pokemon-sprites (manifest), pokemon-types, use-countdown,
│                                    team-dex (builder data), stats (Champions formula), saved-teams,
│                                    dex-names (localized Pokémon names, Phase 4)
├─ packages/
│  ├─ shared/src/                 ✅ constants, avatars, errors, team, team-text (Showdown export), dex
│  │                                 (builder data types), battle, room-state, schemas (zod), events
│  ├─ core/src/
│  │  ├─ rooms/                   ✅ Room, RoomManager, composition, room codes, RoomError (+ tests)
│  │  ├─ battle/showdown.ts       ✅ the ONLY import point for pokemon-showdown (+ smoke tests)
│  │  ├─ team/                    ✅ TeamService (random sets, validation, import), legality (Casual
│  │  │                              validator, legal species / moves / items), dex-data, battleRoster
│  │  ├─ battle/                  ✅ BattleSession (+ runMegaEvo override, public field), MatchController,
│  │  │                              OwnershipLayer (positions, per-player requests, merge, Mega quota),
│  │  │                              TurnTimer, request enrichment (stats, nature, boosts, battleName),
│  │  │                              effects (dex durations)
│  │  └─ time.ts                  ✅ injectable Scheduler (fake one in testing/)
│  └─ data/scripts/               ✅ build-dex.ts (team builder JSON), fetch-sprites.ts (trainers + Pokémon +
│                                    manifest), fetch-audio.ts (cries), build-locales.ts (names.<locale>.json),
│                                    asset-cache.ts (Vercel build cache), lib/ (csv, download, locale rules)
├─ e2e/                          ✅ Playwright: singles, doubles 2v2, Spanish room, team editor (`pnpm test:e2e`)
├─ render.yaml                   ✅ Render Blueprint: backend (docs/16-first-deploy.md)
├─ vercel.json                   ✅ Vercel: frontend build, SPA rewrite, cache headers
└─ docs/
```

## Basic security

- 4-letter room codes (24-letter alphabet without I/O → ~331k combinations). ✅ Rate limiting on
  `player:join` per IP (token bucket).
- Max 4 players per room in v1 (2 per team). ✅ Max 5 open rooms per IP (`x-forwarded-for` in production).
- ✅ The stateless team builder events (`builder:*`, D-51) are rate-limited per IP (token bucket).
- The server never trusts clients: validates ownership of every position, choices against the current
  `request`, and teams with `TeamValidator`.
- No passwords or accounts (AirConsole-style): the room code is the only key. Rooms are ephemeral and
  the Host can kick unwanted players.
