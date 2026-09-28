# 10 — Development guide

Everything needed to run, test and extend the codebase. Read `CLAUDE.md` first for the project rules.

## Prerequisites

- **Node.js ≥ 22.22.0** (see `.nvmrc`). Vitest 5 and React Router 8 refuse older versions.
  With nvm-windows: `nvm install 22.22.0 && nvm use 22.22.0` (nvm-windows does not read `.nvmrc` automatically).
- **pnpm 10** (`packageManager` field pins 10.33.2; `corepack enable` or a global pnpm works).

## First run

```bash
pnpm install          # installs every workspace package
pnpm fetch:sprites    # downloads trainer sprites into apps/web/public/sprites (git-ignored)
cp .env.example .env  # optional: defaults work for local development
pnpm dev              # server on :3001 + web on :5173 (both watch mode)
```

Open `http://localhost:5173/host` on the PC. The QR automatically points to the PC's **LAN IP**
(the Host asks the backend's `/api/info` for it), so phones on the same Wi-Fi can scan and join.

LAN notes:

- Windows asks to allow Node.js through the firewall the first time: allow **private networks**
  (ports 5173 and 3001 must be reachable from the phones).
- Plain `http://192.168.x.x` is not a secure context, so the **Wake Lock API is unavailable on phones in LAN
  dev** (it silently no-ops). It works in production (HTTPS) and on `localhost`.
- To test without phones: open `http://localhost:5173/j/<CODE>` in other browser windows (use a private
  window or another browser per player, since the seat is stored in `localStorage`).

## Commands (repo root)

| Command                                      | What it does                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm dev`                                   | Server (`tsx watch`) + web (Vite) in parallel                                             |
| `pnpm test` / `pnpm test:watch`              | Vitest over every `*.test.ts(x)` in `apps/*/src` and `packages/*/src`                     |
| `pnpm typecheck`                             | `tsc --noEmit` in every package                                                           |
| `pnpm lint`                                  | `lint:js` (ESLint) + `lint:styles` (Stylelint on `apps/web/src/**/*.scss`)                |
| `pnpm lint:fix`                              | ESLint + Stylelint with `--fix`                                                           |
| `pnpm format` / `pnpm format:check`          | Prettier (+ Tailwind class sorting)                                                       |
| `pnpm check`                                 | typecheck + lint + format:check + test (run before handing work back)                     |
| `pnpm build`                                 | Web → `apps/web/dist`; server → `apps/server/dist` (tsup bundle incl. workspace packages) |
| `pnpm fetch:sprites`                         | Download missing sprites (idempotent, sequential, polite)                                 |
| `pnpm --filter @poke-air/core sim:smoke [n]` | Simulator benchmark: load time, RAM, ms/turn (spike S1)                                   |
| `pnpm --filter @poke-air/server start`       | Run the built server (`node dist/index.js`)                                               |

Single package: `pnpm --filter @poke-air/<name> <script>`.

## Environment variables

One `.env` at the repo root, read by both apps (server via `--env-file-if-exists`, Vite via `envDir`).
See `.env.example`.

| Variable              | App    | Default                        | Notes                                                                                |
| --------------------- | ------ | ------------------------------ | ------------------------------------------------------------------------------------ |
| `PORT`                | server | `3001`                         |                                                                                      |
| `ALLOWED_ORIGINS`     | server | any (dev only)                 | Comma-separated. **Required in production** (the server refuses to start without it) |
| `LOG_LEVEL`           | server | `info`                         | Pino level                                                                           |
| `VITE_BACKEND_URL`    | web    | `<current hostname>:3001`      | Set in production (Render URL)                                                       |
| `VITE_PUBLIC_APP_URL` | web    | LAN IP in dev / current origin | URL encoded in the join QR                                                           |

## How the code is organized

See the tree in `docs/02-architecture.md` (✅/🔜 markers). Key rules:

- **`packages/shared`** — contracts only: constants, zod schemas, event types, public state types. No logic
  with side effects (`"sideEffects": false` lets Vite tree-shake it). Imported by server and web.
- **`packages/core`** — pure domain logic (rooms, teams, battles). No sockets, no HTTP, no Node-only APIs
  (use Web Crypto, not `node:crypto`), injectable clock/ids for tests. Throws `RoomError(code)` for rule
  violations.
- **`apps/server`** — transport only: validate → call core → broadcast. No game rules here.
- **`apps/web`** — two faces (`host/`, `controller/`) + shared `components/`, `lib/`, `i18n/`. One zustand
  store per face owns its socket.
- Internal packages export TypeScript **sources** (`"exports": "./src/index.ts"`): no build step between
  packages. Vite and tsx consume them directly; the server's tsup build bundles them (`noExternal`).
- Relative imports inside `packages/*` and `apps/server` use the `.js` extension (ESM); the web app uses
  extensionless imports (Vite).

## Styles (web)

Visual rules live in `docs/12-design-system.md`. How the code is split:

- **`apps/web/src/index.css`** — Tailwind entry + all design tokens in `@theme static` (colors, fonts,
  radii, shadows). The only place with raw color values. Plain CSS: Tailwind 4 is not run through Sass.
- **`apps/web/src/styles/`** — SCSS for design-system pieces, loaded by `main.scss` **inside Tailwind's
  `components` layer**, so utilities on an element always win:
  - `abstracts/` — `color(name)` / `alpha(name, %)` token helpers and mixins (`pressable`, `deco-ball`,
    `team-palette`). No CSS output.
  - `base/` — decoration assets (`--deco-*`), keyframes, reduced motion, team scopes
    (`.team-scope--red|blue|neutral` set `--c/--deep/--soft/--tint`).
  - `components/` — one partial per primitive (`_button`, `_poke-ball`, `_status-pill`, …).
  - `screens/` — screen-level decoration (`_home`, `_host`, `_controller`).
- **React primitives** in `apps/web/src/components/ui/` (`Button`, `IconButton`, `Icon`, `PokeBall`,
  `StatusPill`, `TeamChip`, `HpBar`, `Logo`, `CodeChip`) wrap those classes.
- **Rule of thumb:** SCSS for 3D states, pseudo-element decoration, multi-layer backgrounds and animations;
  Tailwind utilities for layout, spacing, sizing and typography at the call site. Join conditional classes
  with `cn()` (`lib/cn.ts`).
- Class names in SCSS are BEM (`block__element--modifier`). Colors only via tokens: Stylelint rejects hex,
  named colors and `rgb()/hsl()` in SCSS; ESLint rejects hex literals in `apps/web` TS/TSX. Quote token names
  that collide with CSS color keywords: `color('gold')`.

## Lint and format rules

- **Prettier** (`.prettierrc.json`): 100 cols, single quotes, semicolons, trailing commas, LF,
  `prettier-plugin-tailwindcss` (sorts classes in `className` and `cn(...)`).
- **ESLint** (`eslint.config.js`): `js` + `typescript-eslint` recommended, `eqeqeq`, `no-console` (warn;
  off in `**/scripts/**`), `prefer-const`, `prefer-template`, `object-shorthand`, `no-param-reassign`,
  `no-non-null-assertion`, `consistent-type-imports`, `consistent-type-definitions: interface`; web adds
  `react-hooks`, `react-refresh` and the no-raw-hex rule. `eslint-config-prettier` goes last.
- **Stylelint** (`stylelint.config.js`): `stylelint-config-standard-scss` + token-only colors, BEM class
  pattern, no IDs, no `!important`, nesting depth ≤ 3, `@use` only (no `@import`).

## Recipe: adding a realtime feature

Example: a new player action `player:foo`.

1. **Schema** — add `playerFooSchema` + `PlayerFooPayload` type in `packages/shared/src/schemas.ts`.
2. **Contract** — add `'player:foo': (payload: PlayerFooPayload, ack: Ack<...>) => void` to
   `PlayerClientToServerEvents` in `packages/shared/src/events.ts`. New error codes go in `errors.ts`
   **and** in `apps/web/src/i18n/locales/en/ui.json` (`errors.<CODE>`).
3. **Domain** — implement the rule in `packages/core` (method on `Room` or a service) and unit-test it.
4. **Transport** — register in `apps/server/src/transport/player-handlers.ts`:
   `socket.on('player:foo', on(playerFooSchema, (payload) => { ...core call...; rt.broadcast(room); }))`.
   The `on()` helper validates, acks `Result`, and maps `RoomError`. Add an integration test in
   `apps/server/src/app.test.ts` (real server on port 0 + `socket.io-client` with `forceNew: true`).
5. **Client** — add an action to the store (`controller-store.ts` / `host-store.ts`) using
   `socket.emitWithAck(...)`; on `{ ok: false }` store `error.code`.
6. **UI** — components read the store; every string is a typed i18n key (`t('controller.foo')`), added to
   `locales/en/ui.json`. TypeScript fails on unknown keys.
7. Update `docs/02-architecture.md` (event tables) if the protocol changed. Run `pnpm check`.

## Testing strategy

- **Unit (core):** rules and state machines with injected `now`/`newId`/`randomInt`. Fast, no I/O.
- **Integration (server):** `buildApp()` + `listen({ port: 0 })` + real Socket.IO clients.
- **Simulator (core):** `battle/showdown.test.ts` plays real battles with `default` choices. Use these as
  the template for BattleSession/OwnershipLayer tests (scripted choices instead of `default`).
- **E2E (planned, Phase 1 hardening):** Playwright with 1 Host context + N mobile contexts. During Phase 0
  this was done ad hoc with `playwright-core` and the system Edge (`chromium.launch({ channel: 'msedge' })`),
  which avoids downloading browsers.

## Pitfalls (learned the hard way)

- **Import Showdown only through `packages/core/src/battle/showdown.ts`.** `pokemon-showdown` is CommonJS;
  in native Node ESM a named import (`import { Dex } from 'pokemon-showdown'`) is `undefined` at runtime.
  The adapter handles both Node ESM and bundlers.
- **Battle end detection:** the spectator log starts with `|tier|...`, so `includes('|tie')` is true from
  the first chunk. Use `/^\|(win\||tie$)/m`.
- **Server-side disconnects:** use `socket.disconnect()` (namespace only). `disconnect(true)` closes the
  whole underlying connection, killing other namespaces on the same client.
- **After a server-side disconnect the client does not auto-reconnect** (`io server disconnect`); call
  `socket.connect()` before emitting again (see `controller-store.ts` `sendJoin`).
- **React StrictMode** runs effects twice in dev: store `start()`/`open()` return a cleanup that fully
  tears down the socket; keep that pattern.
- **Champions custom games enable Team Preview**; append `@@@!Team Preview` to the format id unless a
  preview phase is implemented.
- **Tailwind 4 drops unused theme variables.** Tokens read only from SCSS (`var(--color-*)`) would vanish;
  that's why `index.css` uses `@theme static`. Keep it.
- **`**/*` inside a CSS block comment closes it** (`*/`) and breaks the Tailwind build. Don't write globs in
  CSS comments.
- **PowerShell `Get-Content`/`Set-Content` default to ANSI** on Windows PowerShell 5.1 and corrupt UTF-8
  (`—` → `â€”`). Edit files with the editor/Node, or pass `-Encoding utf8`.
- **TypeScript is pinned to 6.0.x**: TS 7 (native) is not supported by typescript-eslint yet (`<6.1.0`).
- **`pokemon-showdown` npm lags GitHub master** (e.g. no Champions Random Doubles in 0.11.11). Pin the exact
  version; when upgrading run `pnpm check` + `sim:smoke` and re-verify the facts table in `docs/05`.
- The package pulls `sqlite3`/`better-sqlite3` (Showdown chat server features); their build scripts are
  intentionally ignored in `pnpm-workspace.yaml`.

## Simulator baseline (spike S1, measured 2026-09-25, Node 22.22, pokemon-showdown 0.11.11)

| Measure                               | Value                                |
| ------------------------------------- | ------------------------------------ |
| Process baseline                      | RSS 69 MB                            |
| Champions dex + random sets loaded    | +410 ms, RSS 173 MB                  |
| After 20 singles + 20 doubles battles | RSS ~208 MB, heap ~109 MB            |
| Turn resolution                       | ~1.0 ms (singles), ~2.4 ms (doubles) |

Conclusion: fits comfortably in Render's free 512 MB instance.
