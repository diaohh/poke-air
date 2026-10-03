# CLAUDE.md â€” Poke-Air

Context for Claude (and any developer) working in this repo. Read this first; details live in `docs/`.

## What it is

**Poke-Air** is a web app for **local, same-room multiplayer PokÃ©mon battles**, inspired by
**PokÃ©mon Showdown** (battle mechanics and UI) and **AirConsole** (the big screen is the "stadium",
phones are the controllers).

- A **PC/TV (Host)** opens `/host`, which creates a room and shows a **room code + QR**.
- Players scan the QR with their **phone (Controller)** â†’ `/j/:code`, enter a name, pick a trainer avatar
  (Cynthia, Lance, Redâ€¦) and split into **two teams** (red/blue).
- **Team building** on the phone (meta randomizer + per-PokÃ©mon editor).
- The **battle** is rendered on the Host screen; each player picks moves/switches **privately** on their phone.
- v1 formats: **singles 1v1** and **doubles 1v1 / 1v2 / 2v2**. Champions-style rules: level 50, IVs fixed,
  Stat Points, **Mega Evolution only (one per player)**. Triples are a future extension.
- Non-commercial fan project, to be hosted at **$0** (Vercel/Cloudflare + Render free tier).

## Current status

- âœ… **Phase 0 done**: monorepo + tooling + lobby vertical slice + "Stadium Wine" design system.
- âœ… **Phase 1 implemented** (pending manual validation): randomizer team building + Ready, automatic battle
  start, singles battles (moves, switches, Mega, timer, undo, forfeit) with the Host scene animated from the
  spectator log and private phone controls, battle log panel, Host audio (ZzFX + optional music/cries),
  results + rematch, refresh/rejoin in every phase, rate limits.
  `pnpm check` green (76 tests) + `pnpm test:e2e`. What changed vs. the plan: `docs/11-phase-1-plan.md` Â§ Status.
- âœ… **Battle-info iteration + Phase 2 implemented** (pending manual validation, 2026-09-28): stats / nature /
  stat stages on the phone, field effects with turns left on the Host, spike S3, full team builder (editor,
  `TeamValidator`, Showdown import/export, saved teams), generated builder data (`pnpm build:data`).
  Plan, results and checklist: `docs/13-phase-2-plan.md`.
- âœ… **Phase 3 implemented** (pending manual validation, 2026-09-28): spike S2, doubles 1v1 / 1v2 / 2v2
  (OwnershipLayer: per-player requests, per-position merge, forced-switch hand-over, timer defaults),
  target selection, one Mega per player, doubles Host scene, item icons. v1 scope is feature-complete.
  Plan, S2 results and checklist: `docs/14-phase-3-plan.md`.
- âœ… **Phase 3 feedback round 1** (pending manual validation): phone Home (Join + Team builder), standalone
  team builder `/teams` (stateless `builder:*` events), editor ðŸŽ² = new set for the same species, "choose which
  PokÃ©mon to keep" on oversized imports, Host field effect visuals, smaller lobby VS, effect chips as "left/total", close room / back home (D-50â€¦D-57,
  docs 14).
- âœ… **Phase 4 implemented** (pending manual validation): Spanish (es-ES) UI and PokÃ©mon names
  (`pnpm build:locales` from Showdown `data/text/es` at a pinned commit, `useDexNames()`, bilingual search).
  Plan, spike S4 results and checklist: `docs/15-phase-4-plan.md`.
- âœ… **Tests for Phases 2â€“4 + first deploy prepared** (2026-10-03): OwnershipLayer / scripted doubles battles,
  HostBattleModel (substitute, `-block`, boosts, field effects, doubles), TeamService / Room editing, server team and
  builder events, `build:locales` rules, locale key parity; E2E for singles, doubles 2v2, a Spanish room and the team
  editor. `pnpm check` green. Deploy (spike S6, D-64â€¦D-67): `render.yaml` + `vercel.json`, asset cache for
  the Vercel build, backend warm-up ping, rehearsed locally. Step by step + real-phone checklist: `docs/16-first-deploy.md`.
- ðŸ‘‰ **Next:** manual validation of Phases 2â€“4 (checklists in docs 13â€“15) â†’ deploy by hand and run the S6 checklist
  (docs 16) â†’ Phase 5 (polish). Remaining test gaps are listed in docs 13â€“15 Â§ Tests.
- Not done on purpose: CI (decision D-23).

## Documents

| File                                    | Content                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `docs/01-vision-and-game-flow.md`       | Vision, screens, room flow (lobby â†’ team building â†’ battle â†’ results)         |
| `docs/02-architecture.md`               | Architecture, stack, **event protocol**, repo tree (âœ… built / ðŸ”œ planned)       |
| `docs/03-data-sources-and-licensing.md` | Data sources (Showdown, PokeAPI, sprites) and copyright/licensing                   |
| `docs/04-battle-modes.md`               | Singles/doubles mapping onto the sim, OwnershipLayer, Mega per player + edge cases  |
| `docs/05-game-rules-and-mechanics.md`   | Champions format, ruleset presets, randomizer, **verified simulator facts**         |
| `docs/06-i18n.md`                       | i18n: language availability in sources, per-room locale                             |
| `docs/07-hosting-and-deployment.md`     | $0 hosting strategy and alternatives                                                |
| `docs/08-decisions.md`                  | Decision log (D-01â€¦D-63) + open questions                                         |
| `docs/09-roadmap.md`                    | Status, spikes, phases, risks                                                       |
| `docs/10-development.md`                | **Setup, commands, env vars, feature recipe, testing, pitfalls**                    |
| `docs/11-phase-1-plan.md`               | Phase 1 plan + **what was actually built** (Â§ Status)                              |
| `docs/12-design-system.md`              | **UI design system** (tokens, components, screen specs) â€” read before any UI work |
| `docs/13-phase-2-plan.md`               | Battle-info iteration + Phase 2 (team builder): analysis, S3 results, status        |
| `docs/14-phase-3-plan.md`               | Phase 3 (doubles, OwnershipLayer, item icons) + feedback round 1: S2, decisions     |
| `docs/15-phase-4-plan.md`               | Phase 4 (Spanish): spike S4 coverage, decisions, what was built, checklist          |
| `docs/16-first-deploy.md`               | First deploy (spike S6): Render + Vercel step by step, rehearsal, real-phone tests  |
| `docs/design/ui-mockup.html`            | Interactive HTML mockup (~70 KB; open only for a specific screen, the .md wins)     |

## Commands

```bash
nvm use 22.22.0        # Node â‰¥ 22.22 required (.nvmrc)
pnpm install
pnpm fetch:sprites     # trainer + PokÃ©mon sprites + item icon sheet â†’ apps/web/public/sprites (git-ignored, never commit)
pnpm fetch:audio       # optional PokÃ©mon cries â†’ apps/web/public/audio/cries (git-ignored, never commit)
pnpm build:data        # team builder JSON â†’ apps/web/public/data (git-ignored; dev/build run it, skips if current)
pnpm build:locales     # localized PokÃ©mon names (Showdown data/text at a pinned commit) â†’ apps/web/public/data
pnpm dev               # build:data + build:locales + server :3001 + web :5173 â†’ open http://localhost:5173/host
pnpm check             # typecheck + lint (ESLint + Stylelint) + format:check + test â€” run before handing work back
pnpm test:e2e          # Playwright: singles, doubles 2v2, Spanish room, team editor (system Edge; reuses pnpm dev)
                       # E2E_BASE_URL=https://<app> pnpm test:e2e runs them against a deployment
pnpm lint:fix          # ESLint + Stylelint autofix; `pnpm format` for Prettier
pnpm build             # build:data, then web â†’ apps/web/dist, server â†’ apps/server/dist
pnpm build:web:deploy  # Vercel build: asset cache + sprites/cries download + data + web (docs/16)
pnpm build:server      # Render build: server bundle only
pnpm --filter @poke-air/core sim:smoke   # simulator benchmark
```

## Architecture principles (do not break)

1. **Authoritative server.** All room and battle state lives on the server. Host and phones only render
   state and send intents. Never simulate the battle on a client.
2. **The simulator is PokÃ©mon Showdown** (`pokemon-showdown` 0.11.11, MIT, pinned). Never reimplement
   mechanics. **Import it only via `packages/core/src/battle/showdown.ts`** (CommonJS interop adapter).
3. **Layering:** `packages/shared` = contracts (constants, zod schemas, event types; no side effects) Â·
   `packages/core` = pure domain logic (no sockets/HTTP/Node-only APIs; injectable clock/ids; throws
   `RoomError(code)`) Â· `apps/server` = transport only (validate â†’ core â†’ broadcast) Â· `apps/web` = UI.
4. **Privacy by design.** The Host receives only public data (room state, spectator battle stream). Each
   phone receives only its own private data (its team, its battle requests). Never send another player's
   team or reconnect token to a client.
5. **The Host is a "dumb screen"** that plays the battle log as an animation queue. Game logic never
   depends on the Host finishing animations (only controller UX does, with a timeout).
6. **Phones are fragile.** Every seat has `playerId` + `reconnectToken` (localStorage) and can be rejoined
   in any phase; the Host resumes with `hostToken` (sessionStorage).
7. **No hardcoded PokÃ©mon data.** Everything comes from the Showdown dex (and its `data/text/<lang>` tables
   for translations, built by `packages/data`).
8. **i18n from day one.** No user-facing string literals: typed keys in `apps/web/src/i18n/locales/en/ui.json`
   (every key also in `es-ES`); PokÃ©mon names are shown through `useDexNames()` (the server speaks English).
   The server sends error **codes**, never prose.

## Protocol conventions

- Socket.IO namespaces `/host` and `/player`; events `domain:action`; every client event is
  `(payload, ack)` â†’ server validates with zod and acks `{ ok: true, ...data } | { ok: false, error: { code } }`.
- After each mutation the server broadcasts the full public `room:state` snapshot.
- Source of truth: `packages/shared/src/events.ts` + `schemas.ts`. Recipe for new features: `docs/10-development.md`.

## Licensing rules for code (important)

- âœ… OK: `pokemon-showdown` (MIT), `@pkmn/*` (MIT), `@smogon/calc` (MIT), Showdown `data/text/*` (MIT).
- âŒ **Never copy code or CSS from `pokemon-showdown-client`** (AGPLv3). Visual inspiration only.
- Sprites/names/music belong to Nintendo/Game Freak/Creatures/TPC. Self-host sprites via
  `pnpm fetch:sprites` (never hotlink Showdown, never commit assets). Keep credits + disclaimer.

## Stack

TypeScript 6.0 (strict; TS 7 blocked by typescript-eslint) Â· pnpm workspaces Â· Node â‰¥ 22.22 Â·
**Server:** Fastify 5, Socket.IO 4, zod 4, pino, tsup, tsx Â· **Web:** Vite 8, React 19, React Router 8,
Zustand 5, Tailwind CSS 4 + Sass (SCSS), Fontsource fonts, i18next/react-i18next, qrcode.react Â·
**Battle:** Showdown `Battle` driven by core `BattleSession`/`MatchController`; `@pkmn/protocol` + own
reducer (`HostBattleModel`) on the Host; `@pkmn/img` at sprite-download time (manifest) Â·
**Tooling:** ESLint 10 + eslint-config-prettier, Stylelint (standard-scss), Prettier + tailwind plugin Â·
**Tests:** Vitest 5, Playwright (`@playwright/test`, system Edge).

## Conventions

- **Everything in English:** code, identifiers, commits, docs, default UI language.
- Tests live next to code as `*.test.ts(x)`; run from the root with `pnpm test`.
- ESM everywhere; relative imports use `.js` in `packages/*` and `apps/server`, extensionless in `apps/web`.
- Host UI is laid out on a fixed 1920Ã—1080 `Stage` (scaled); controller UI is mobile-first (portrait only).
- Visual style follows `docs/12-design-system.md` ("Stadium Wine": light warm theme, wine brand, red/blue
  only for teams). Use the theme tokens, never raw hex values in components (enforced by ESLint/Stylelint).
- Styles: tokens in `apps/web/src/index.css` (`@theme static`), design-system components in SCSS partials
  under `apps/web/src/styles/` (BEM, inside Tailwind's `components` layer), layout with Tailwind utilities.
  Reuse the primitives in `apps/web/src/components/ui/`. Details: `docs/10-development.md` Â§ Styles.
- Room phases are an explicit state machine in `Room`: `LOBBY â†’ TEAM_BUILDING â†’ BATTLE â†’ RESULTS â†’ LOBBY`.
- Read the **Pitfalls** section of `docs/10-development.md` before touching sockets or the simulator.
- Git is managed manually by the user: don't commit unless asked.
