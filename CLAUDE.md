# CLAUDE.md — Poke-Air

Context for Claude (and any developer) working in this repo. Read this first; details live in `docs/`.

## What it is

**Poke-Air** is a web app for **local, same-room multiplayer Pokémon battles**, inspired by
**Pokémon Showdown** (battle mechanics and UI) and **AirConsole** (the big screen is the "stadium",
phones are the controllers).

- A **PC/TV (Host)** opens `/host`, which creates a room and shows a **room code + QR**.
- Players scan the QR with their **phone (Controller)** → `/j/:code`, enter a name, pick a trainer avatar
  (Cynthia, Lance, Red…) and split into **two teams** (red/blue).
- **Team building** on the phone (meta randomizer + per-Pokémon editor).
- The **battle** is rendered on the Host screen; each player picks moves/switches **privately** on their phone.
- v1 formats: **singles 1v1** and **doubles 1v1 / 1v2 / 2v2**. Champions-style rules: level 50, IVs fixed,
  Stat Points, **Mega Evolution only (one per player)**. Triples are a future extension.
- Non-commercial fan project, to be hosted at **$0** (Vercel/Cloudflare + Render free tier).

## Current status

- ✅ **Phase 0 done**: monorepo + tooling + **lobby vertical slice working end-to-end** (create room, QR with
  LAN IP, join/rejoin, switch team, kick, Host resume, composition validation, LOBBY ↔ TEAM_BUILDING).
  Simulator smoke-tested with the Champions mod. `pnpm check` green.
- 👉 **Next: Phase 1 (playable singles MVP)** — follow **`docs/11-phase-1-plan.md`** (work packages WP1–WP8,
  decisions already taken, definition of done).
- Not done on purpose: CI/CD and deployment (decision D-23).

## Documents

| File                                    | Content                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `docs/01-vision-and-game-flow.md`       | Vision, screens, room flow (lobby → team building → battle → results)              |
| `docs/02-architecture.md`               | Architecture, stack, **event protocol**, repo tree (✅ built / 🔜 planned)         |
| `docs/03-data-sources-and-licensing.md` | Data sources (Showdown, PokeAPI, sprites) and copyright/licensing                  |
| `docs/04-battle-modes.md`               | Singles/doubles mapping onto the sim, OwnershipLayer, Mega per player + edge cases |
| `docs/05-game-rules-and-mechanics.md`   | Champions format, ruleset presets, randomizer, **verified simulator facts**        |
| `docs/06-i18n.md`                       | i18n: language availability in sources, per-room locale                            |
| `docs/07-hosting-and-deployment.md`     | $0 hosting strategy and alternatives                                               |
| `docs/08-decisions.md`                  | Decision log (D-01…D-23) + open questions                                          |
| `docs/09-roadmap.md`                    | Status, spikes, phases, risks                                                      |
| `docs/10-development.md`                | **Setup, commands, env vars, feature recipe, testing, pitfalls**                   |
| `docs/11-phase-1-plan.md`               | **Next session's implementation plan**                                             |
| `docs/12-design-system.md`              | **UI design system** (tokens, components, screen specs) — read before any UI work  |
| `docs/design/ui-mockup.html`            | Interactive HTML mockup (~70 KB; open only for a specific screen, the .md wins)    |

## Commands

```bash
nvm use 22.22.0        # Node ≥ 22.22 required (.nvmrc)
pnpm install
pnpm fetch:sprites     # trainer sprites → apps/web/public/sprites (git-ignored, never commit)
pnpm dev               # server :3001 + web :5173 → open http://localhost:5173/host
pnpm check             # typecheck + lint + test — run before handing work back
pnpm build             # web → apps/web/dist, server → apps/server/dist
pnpm --filter @poke-air/core sim:smoke   # simulator benchmark
```

## Architecture principles (do not break)

1. **Authoritative server.** All room and battle state lives on the server. Host and phones only render
   state and send intents. Never simulate the battle on a client.
2. **The simulator is Pokémon Showdown** (`pokemon-showdown` 0.11.11, MIT, pinned). Never reimplement
   mechanics. **Import it only via `packages/core/src/battle/showdown.ts`** (CommonJS interop adapter).
3. **Layering:** `packages/shared` = contracts (constants, zod schemas, event types; no side effects) ·
   `packages/core` = pure domain logic (no sockets/HTTP/Node-only APIs; injectable clock/ids; throws
   `RoomError(code)`) · `apps/server` = transport only (validate → core → broadcast) · `apps/web` = UI.
4. **Privacy by design.** The Host receives only public data (room state, spectator battle stream). Each
   phone receives only its own private data (its team, its battle requests). Never send another player's
   team or reconnect token to a client.
5. **The Host is a "dumb screen"** that plays the battle log as an animation queue. Game logic never
   depends on the Host finishing animations (only controller UX does, with a timeout).
6. **Phones are fragile.** Every seat has `playerId` + `reconnectToken` (localStorage) and can be rejoined
   in any phase; the Host resumes with `hostToken` (sessionStorage).
7. **No hardcoded Pokémon data.** Everything comes from the Showdown dex (and its `data/text/<lang>` tables
   for translations, built by `packages/data`).
8. **i18n from day one.** No user-facing string literals: typed keys in `apps/web/src/i18n/locales/en/ui.json`.
   The server sends error **codes**, never prose.

## Protocol conventions

- Socket.IO namespaces `/host` and `/player`; events `domain:action`; every client event is
  `(payload, ack)` → server validates with zod and acks `{ ok: true, ...data } | { ok: false, error: { code } }`.
- After each mutation the server broadcasts the full public `room:state` snapshot.
- Source of truth: `packages/shared/src/events.ts` + `schemas.ts`. Recipe for new features: `docs/10-development.md`.

## Licensing rules for code (important)

- ✅ OK: `pokemon-showdown` (MIT), `@pkmn/*` (MIT), `@smogon/calc` (MIT), Showdown `data/text/*` (MIT).
- ❌ **Never copy code or CSS from `pokemon-showdown-client`** (AGPLv3). Visual inspiration only.
- Sprites/names/music belong to Nintendo/Game Freak/Creatures/TPC. Self-host sprites via
  `pnpm fetch:sprites` (never hotlink Showdown, never commit assets). Keep credits + disclaimer.

## Stack

TypeScript 6.0 (strict; TS 7 blocked by typescript-eslint) · pnpm workspaces · Node ≥ 22.22 ·
**Server:** Fastify 5, Socket.IO 4, zod 4, pino, tsup, tsx · **Web:** Vite 8, React 19, React Router 8,
Zustand 5, Tailwind CSS 4, i18next/react-i18next, qrcode.react · **Battle (planned):** `@pkmn/protocol` +
own reducer on the Host, `@pkmn/img` for sprite URLs · **Tests:** Vitest 5 (Playwright E2E planned).

## Conventions

- **Everything in English:** code, identifiers, commits, docs, default UI language.
- Tests live next to code as `*.test.ts(x)`; run from the root with `pnpm test`.
- ESM everywhere; relative imports use `.js` in `packages/*` and `apps/server`, extensionless in `apps/web`.
- Host UI is laid out on a fixed 1920×1080 `Stage` (scaled); controller UI is mobile-first (portrait only).
- Visual style follows `docs/12-design-system.md` ("Stadium Wine": light warm theme, wine brand, red/blue
  only for teams). Use the theme tokens, never raw hex values in components.
- Room phases are an explicit state machine in `Room`: `LOBBY → TEAM_BUILDING → BATTLE → RESULTS → LOBBY`.
- Read the **Pitfalls** section of `docs/10-development.md` before touching sockets or the simulator.
- Git is managed manually by the user: don't commit unless asked.
