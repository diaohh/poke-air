# 09 — Roadmap, spikes and feasibility

## Technical feasibility: **high**

The hardest part of a Showdown-like game, the **battle simulator** with every mechanic (including
Champions rules, Megas, spread moves, redirection), already exists under MIT and is designed to be
used as a library. Even Spanish names and most battle messages exist. What remains is glue and UI:

| Area                                              | Difficulty                                      | Comment                                                                                    |
| ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Rooms, QR, lobby, reconnection                    | Medium                                          | Known pattern (Jackbox/AirConsole). Mobile reconnection needs care                         |
| Simulator integration                             | Low–Medium                                      | Well-documented stream API; Champions mod ready                                            |
| OwnershipLayer (shared teams, doubles only in v1) | **Medium**                                      | Own logic with edge cases (faints, Ally Switch, forced switches). Needs strong tests       |
| Mega per player                                   | Medium                                          | Instance override of `runMegaEvo` + quota tracking and per-turn lock in the OwnershipLayer |
| Mobile team builder                               | Medium–High                                     | Lots of UI: search, learnsets, Stat Points; heavy data → precompiled JSON                  |
| Host battle scene                                 | **High (effort)**                               | Where most time goes: layout, animation queue, localized narration. Start generic, iterate |
| i18n                                              | Low–Medium                                      | Infrastructure is cheap if done from the start; es-ES data mostly exists                   |
| $0 hosting                                        | Low–Medium                                      | Render cold start handled by UX; memory limits to be measured                              |
| Legal                                             | Low risk without monetization or mass promotion | See `03`                                                                                   |

## Current status (2026-09-25)

- ✅ **Phase 0 done** (without deploy/CI, by decision): monorepo, tooling, lobby vertical slice working
  end-to-end (Host creates room + QR with LAN IP, phones join/switch team/rejoin, Host kicks/resumes,
  composition validation, LOBBY ↔ TEAM_BUILDING), 24 tests green, simulator smoke-tested.
- ✅ **S1 done** — results in `docs/10-development.md` (≈ 210 MB RAM, 1–2.5 ms/turn) and verified simulator
  facts in `docs/05-game-rules-and-mechanics.md`.
- 👉 **Next: Phase 1** — detailed plan in `docs/11-phase-1-plan.md`. Spikes S5 (scene) is folded into Phase 1
  WP5; S2/S3 happen before Phases 3/2; S4 before Phase 2/4; S6 when deploying.

## Technical spikes

- ✅ **S1 — Simulator on Node:** full singles and doubles battles with the Champions mod; `getPlayerStreams`
  and `request` format inspected; RAM/startup measured (fits Render free tier).
- **S2 — OwnershipLayer + Mega per player:** console prototype of doubles 1v2 and 2v2 with two "humans"
  on one side: split requests, merge choices, forced switches after KO, Ally Switch. Override
  `runMegaEvo` on the battle instance, verify that a second Mega on the same side works on a later turn,
  that requests expose `canMegaEvo` correctly afterwards, and that quota tracking from `|-mega|` events is
  reliable. Also learn how to register custom formats when using the package as a library (needed later
  for triples).
- **S3 — Roster & rules:** Champions mod + `NatDex Mod`: validate learnsets for species outside the
  Champions roster, ban Z-Crystals/other gimmick items if they become legal, confirm `Min Team Size = 1`
  override and Stat Point validation (66 total / 32 max).
- **S4 — Data & i18n:** script generating compact JSON for the Casual ruleset (legal species + learnsets +
  items + abilities + natures) with `en` and `es-ES` tables from a pinned Showdown commit; measure gzip
  size; audit `null` names (forms); check if `@pkmn/view`'s formatter accepts custom text tables.
- **S5 — Scene:** Host consuming a recorded spectator log with `@pkmn/protocol` + our own reducer, animating
  switch/move/damage/mega/faint with self-hosted `gen5ani` sprites; check sprite coverage for new Megas.
- **S6 — Mobile & hosting:** real iPhone + Android test of Wake Lock + Socket.IO reconnection after
  screen lock, against a Render free deployment (including cold-start UX).

## Phases

### Phase 0 — Setup ✅

pnpm monorepo, TS strict, lint/format, Vitest, i18n scaffolding (English only), lobby vertical slice.
Deferred by decision: CI and the first deploy (Render + Vercel) — do them whenever convenient.

### Phase 1 — Playable MVP (singles 1v1) 👉 next — see `docs/11-phase-1-plan.md`

- ✅ (done in Phase 0) Create room, QR, join with name + avatar, lobby with 2 teams and team switching,
  room locale selector (English only enabled), reconnection in the lobby.
- Team building **randomizer only** (+ remove Pokémon), Ready button.
- Singles battle with Champions Casual rules: moves, switches, Mega Evolution, timer, forfeit.
- Basic Host scene: sprites, HP, English narration, generic animations.
- Results + rematch. Reconnection.

### Phase 2 — Full team builder

Per-Pokémon editor (species, item, ability, moves, nature, Stat Points), `TeamValidator` validation,
Showdown text import/export, saved teams on the phone.

### Phase 3 — Doubles (completes v1)

OwnershipLayer, target selection, Mega per player with team parity, doubles 1v1 / 1v2 / 2v2.

### Phase 4 — Spanish (es-ES)

Locale tables from Showdown + our overrides, localized UI and battle narration, bilingual search.

### Phase 5 — Polish

Type-based and iconic move animations, weather/terrain effects, audio, spectators, replays, PWA, credits screen.

### Future extensions (backlog)

- **Triples** (custom Champions triples format, compositions up to 3v3).
- Room rules in the lobby: VGC preset with team preview, custom toggles (Item Clause, no legendaries…).
- Optional gimmicks (Tera, Dynamax, Z-Moves).
- Two Megas per team on the same turn (see O-01).

## Main risks

| Risk                                                                                | Mitigation                                                                       |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Phones disconnect mid-turn                                                          | Wake Lock, reconnection tokens, timer + `default`                                |
| Shared-team edge cases                                                              | Spike S2 + unit tests with scripted battles (fixed PRNG seeds)                   |
| Champions + NatDex combination behaves unexpectedly (untested upstream combination) | Spike S3; fall back to Champions roster only if needed                           |
| Mega instance override breaks on a Showdown upgrade                                 | Pin version; dedicated tests for Mega quota behavior                             |
| Battle scene consumes too much time                                                 | MVP with generic animations; iterate later                                       |
| Team builder data too heavy for phones                                              | Precompiled JSON per ruleset, gzip/brotli, caching                               |
| Render free limits (RAM, cold start)                                                | Measure in S1/S6; fallback: Oracle Always Free VM or Host-authoritative option D |
| Nintendo/TPC takedown                                                               | Non-commercial, private instance, disclaimer, no assets in a public repo         |
| Upstream changes (Showdown protocol/data)                                           | Pin versions/commits; upgrade deliberately                                       |
