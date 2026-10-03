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

## Current status (2026-10-03, tests + first deploy prepared)

- ✅ **Deferred tests of Phases 2–4 added** (lists and remaining gaps in `13`, `14`, `15` § Tests): the
  OwnershipLayer (unit + scripted doubles battles with the real sim), HostBattleModel, TeamService / Room
  editing, server team / builder / doubles events, `build:locales` rules, locale key parity; permanent E2E
  for singles, doubles 2v2, a Spanish room and the team editor.
- ✅ **First deploy prepared and rehearsed locally** (spike S6, D-64…D-67, `16-first-deploy.md`):
  `render.yaml`, `vercel.json`, asset cache for the Vercel build, backend warm-up ping.
- 👉 **Next:** manual validation of Phases 2–4 → deploy by hand (`16` § Step by step) → S6 checklist with
  real phones → **Phase 5** (polish).

### Status on 2026-09-28 (Phase 4)

- ✅ **Phase 4 implemented** (pending manual validation): the whole UI and every Pokémon name in Spanish
  (Spain) — `pnpm build:locales` (Showdown `data/text/es` at a pinned commit), `useDexNames()`, es-ES UI
  file, bilingual search, rooms created in the Host screen's language (D-58…D-61, `15-phase-4-plan.md`).
- ✅ **Phase 3 feedback round 2**: effect chips as "left/total", close room / back to Home (D-56, D-57).
- 👉 **Next:** manual validation of Phases 2–4 (checklists in `13`, `14`, `15`) → the tests listed there
  (§ Tests to add) → **Phase 5** (polish) and, when convenient, the first deploy (D-23, spike S6).

### Status on 2026-09-28 (Phase 3)

- ✅ **Phase 3 implemented** (pending manual validation; unit tests after it, as with Phase 2): spike S2,
  doubles 1v1 / 1v2 / 2v2 with the OwnershipLayer (per-player requests, per-position merge, forced-switch
  hand-over, timer defaults), target selection on the phone, Mega Evolution per player, doubles Host
  scene, 90 s doubles timer, minimum 2 Pokémon per doubles side, plus **item icons** in the team builder
  and the battle sheets. Plan, S2 results, decisions D-42…D-49 and manual checklist:
  `docs/14-phase-3-plan.md`. **v1 scope (D-12) is now feature-complete.**
- ✅ **Phase 3 feedback round 1** (pending manual validation): phone Home (Join + Team builder, no Host),
  standalone team builder `/teams`, editor 🎲 = new set for the same species, "choose which Pokémon to
  keep" when a team exceeds the slots, field effect visuals on the Host, smaller lobby VS burst
  (D-50…D-55, `14-phase-3-plan.md` § Feedback round 1).
- ✅ **Spike S4 (i18n)** done; Phase 4 planned in `docs/15-phase-4-plan.md`.
- 👉 **Next:** manual validation of Phases 2–3 and the feedback round (checklists in `13` and `14`) →
  the tests listed in `13` and `14` § Tests to add → **Phase 4** (Spanish, plan in `15`).

### Status on 2026-09-28 (Phase 2)

- ✅ **Battle information iteration + Phase 2 implemented** (pending manual validation; unit tests for the new
  code come after it, as agreed): stats / nature / stat stages in the phone's Pokémon sheet, field effects
  with turns left and hazard layers on the Host, spike S3, full team builder (editor, `TeamValidator`,
  import / export, saved teams), generated team builder data (`pnpm build:data`). Plan, results and manual
  checklist: `docs/13-phase-2-plan.md`.

### Status on 2026-09-27

- ✅ **Phase 1 implemented** (pending manual validation by the team): randomizer team building with Ready,
  automatic battle start (3 s countdown), singles battles on the Champions mod with moves / switches /
  forced switches / Mega Evolution / 60 s timer / undo / forfeit, Host battle scene animated from the
  spectator log, private phone controls, results + rematch, refresh/rejoin in every phase, rate limits.
  71 unit/integration tests + Playwright E2E. Details and deviations: `docs/11-phase-1-plan.md` § Status.
- ✅ UI design system "Stadium Wine" applied to every screen (D-24).
- 👉 Next was Phase 2 (full team builder) — spike S3 first (roster & validation rules), then S4 (data & i18n).

### Earlier status (2026-09-25)

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
- ✅ **S2 — OwnershipLayer + Mega per player** (results in `14-phase-3-plan.md` and `05`): doubles request
  shape and reordering, per-position merge with explicit `pass`, forced switches with fewer Pokémon than
  holes, targets required for single-target moves, `default` completing every remaining position, the
  `runMegaEvo` instance override (a second Mega on a later turn works), `|-mega|` quota tracking, and the
  **one-Pokémon doubles side crash**. Still open for later: registering custom formats when using the
  package as a library (needed for triples).
- ✅ **S3 — Roster & rules** (results in `13-phase-2-plan.md` and `05`): Champions mod + `NatDex Mod`: validate learnsets for species outside the
  Champions roster, ban Z-Crystals/other gimmick items if they become legal, confirm `Min Team Size = 1`
  override and Stat Point validation (66 total / 32 max).
- ✅ **S4 — Data & i18n:** the compact builder JSON was done in Phase 2 (`pnpm build:data`); the i18n part
  (Showdown `data/text/es` at a pinned commit, coverage, `null` formes, formatter choice, size) is done —
  results in `15-phase-4-plan.md`.
- **S5 — Scene:** Host consuming a recorded spectator log with `@pkmn/protocol` + our own reducer, animating
  switch/move/damage/mega/faint with self-hosted `gen5ani` sprites; check sprite coverage for new Megas.
- **S6 — Mobile & hosting:** real iPhone + Android test of Wake Lock + Socket.IO reconnection after
  screen lock, against a Render free deployment (including cold-start UX). Deploy prepared and rehearsed
  locally (`16-first-deploy.md`); the real-phone checklist there is pending.

## Phases

### Phase 0 — Setup ✅

pnpm monorepo, TS strict, lint/format, Vitest, i18n scaffolding (English only), lobby vertical slice.
Deferred by decision: CI and the first deploy (Render + Vercel) — do them whenever convenient.

### Phase 1 — Playable MVP (singles 1v1) ✅ — see `docs/11-phase-1-plan.md`

- ✅ (done in Phase 0) Create room, QR, join with name + avatar, lobby with 2 teams and team switching,
  room locale selector (English only enabled), reconnection in the lobby.
- ✅ Team building **randomizer only** (+ remove Pokémon), Ready button.
- ✅ Singles battle with Champions Casual rules: moves, switches, Mega Evolution, timer, forfeit.
- ✅ Basic Host scene: sprites, HP, English narration, generic animations.
- ✅ Results + rematch. Reconnection. Rate limits. E2E.

### Quick wins — battle feedback ✅ (added to the Phase 1 scope)

Requested after the Phase 1 playtest. UI specs in `12-design-system.md` (§ Host battle scene), audio sources
and rules in `03-data-sources-and-licensing.md` (§ Audio), open choices O-06 / O-12 in `08-decisions.md`.

- [x] **Battle log panel on the Host:** Showdown-style history grouped by turn ("Turn 3 · Garchomp used
      Earthquake! · It's super effective!…") in a side column. It follows the animation (never ahead of it,
      so it can't spoil the turn) and is rebuilt from the whole log after a Host refresh. Reuses the
      narration the scene already produces (`HostBattleModel` events + `battle.log.*` keys).
- [x] **Audio foundation (Host only):** small audio manager on the Web Audio API, unlocked by the Host's
      first click ("Host a battle"), mute + volume in the header (remembered in localStorage). UI SFX
      (join, ready, countdown, results) and generic battle SFX (switch-in, hit ×3 effectiveness, crit, faint,
      stat up/down, status, heal, Mega), CC0 music loops (lobby / battle / victory jingle), optional
      official cries fetched like sprites (`pnpm fetch:audio`, never committed). Phones stay silent (same
      room) and keep the vibration. **Still manual:** pick and add CC0 music files
      (`apps/web/public/audio/README.md`); until then the music is silent.

### Iteration — battle information (requested 2026-09-28) ✅ — see `docs/13-phase-2-plan.md` § Part A

- [x] **Stats in the phone's Pokémon details sheet** (switch menu and forced switch): HP, Atk, Def, SpA,
      SpD, Spe of each own Pokémon, with the stat raised by its nature in **green (▲)** and the lowered
      one in **red (▼)** (state = icon + color, principle 6 of `12-design-system.md`). Data: the request
      already carries the computed `stats` of every own Pokémon (`atk…spe`; HP = max HP from
      `condition`); the **nature is not in the request**, so the server adds it (and its ±stats) from the
      player's own set when enriching the request — owner-only data, never sent to the Host. Show the
      active Pokémon's current stat stages there too (e.g. `Atk +2`).
- [x] **Field effects with their remaining duration on the Host:** weather, terrain, Trick Room / Gravity,
      screens (Reflect, Light Screen, Aurora Veil), Tailwind, Safeguard, Mist… with **turns left**, and
      entry hazards (Spikes ×1–3, Toxic Spikes ×1–2, Stealth Rock, Sticky Web) with their **layers**. The
      spectator protocol carries no durations: `HostBattleModel` counts turns from `-weather` /
      `-fieldstart` / `-sidestart`; the durations come from the dex with the log (`battle:log.effects`:
      5 turns, 8 with Light Clay / weather rocks, which spectators can't see → "5–8" until the base
      duration is exceeded) and repeated `-sidestart` lines count as hazard layers. Chips per side on each
      side card, field-wide ones in the top bar. Not done: mirroring them on the phones (optional).

### Phase 2 — Full team builder ✅ (pending manual validation) — see `docs/13-phase-2-plan.md`

Per-Pokémon editor (species, item, ability, moves, nature, Stat Points), `TeamValidator` validation,
Showdown text import/export, saved teams on the phone. Spike S3 done; S4 is reduced to the i18n part
(the compact data generator exists: `pnpm build:data`).

### Phase 3 — Doubles (completes v1) ✅ (pending manual validation) — see `docs/14-phase-3-plan.md`

OwnershipLayer, target selection, Mega per player with team parity, doubles 1v1 / 1v2 / 2v2. Also item
icons (D-42). Known gap: Revival Blessing (picking a fainted Pokémon) is left to the turn timer.

### Phase 4 — Spanish (es-ES) ✅ (pending manual validation) — see `docs/15-phase-4-plan.md`

Locale tables from Showdown + our overrides, localized UI and battle narration, bilingual search.
Spike S4 done (coverage: moves / abilities / natures / types 100 %, species 81 %, items 78 %,
descriptions 0 %). TODO:

- [x] **Spike S4 (i18n part):** Showdown `data/text/es` at a pinned commit, coverage measured, own
      narration keys instead of a template engine (proposed D-58), names JSON ≈ 58 KB.
- [x] `packages/data`: `build:locales` → `names.es-ES.json` (species / moves / abilities / items / types /
      natures / stats by Showdown id), forme suffix table + overrides, English fallback (proposed D-59).
- [x] `SUPPORTED_LOCALES` adds `es-ES`; the Host language selector enables it; default to the Host
      browser language; phones follow the room locale (`room:state`).
- [x] `apps/web`: `locales/es-ES/ui.json` (every key, typed like `en`, narration included), trainer
      names, lazy-loaded names per locale (`useDexNames()`).
- [x] Localize by id everywhere a dex name is shown: team builder (pickers, cards, editor, `/teams`),
      phone battle (moves, Pokémon, items, abilities, targets), Host (side cards, narration, battle log,
      field chips, results).
- [x] Bilingual search in the pickers (localized + English name); Showdown import / export stays English;
      descriptions and `INVALID_SET` details stay English (proposed D-60, D-38).
- [x] Docs: `06` (measured coverage, final architecture), `02`, `10`, `12`, `CLAUDE.md`, `15`.

### Phase 5 — Polish

Type-based and iconic move animations, weather/terrain effects, richer audio (per-type move SFX, more
themes), spectators, replays, PWA, credits screen.

### Future extensions (backlog)

- **Triples** (custom Champions triples format, compositions up to 3v3).
- Room rules in the lobby: VGC preset with team preview, custom toggles (Item Clause, no legendaries…).
- Optional gimmicks (Tera, Dynamax, Z-Moves).
- Two Megas per team on the same turn (see O-01).
- Revival Blessing support on the phone (choose a fainted Pokémon to revive).
- Field effects mirrored on the phones (optional, from the battle-information iteration).

## Main risks

| Risk                                                                                | Mitigation                                                                        |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Phones disconnect mid-turn                                                          | Wake Lock, reconnection tokens, timer + `default`                                 |
| Shared-team edge cases                                                              | Spike S2 ✅; unit tests with scripted battles (fixed PRNG seeds) after validation |
| Champions + NatDex combination behaves unexpectedly (untested upstream combination) | Spike S3; fall back to Champions roster only if needed                            |
| Mega instance override breaks on a Showdown upgrade                                 | Pin version; dedicated tests for Mega quota behavior                              |
| Battle scene consumes too much time                                                 | MVP with generic animations; iterate later                                        |
| Team builder data too heavy for phones                                              | Precompiled JSON per ruleset, gzip/brotli, caching                                |
| Render free limits (RAM, cold start)                                                | Measure in S1/S6; fallback: Oracle Always Free VM or Host-authoritative option D  |
| Nintendo/TPC takedown                                                               | Non-commercial, private instance, disclaimer, no assets in a public repo          |
| Upstream changes (Showdown protocol/data)                                           | Pin versions/commits; upgrade deliberately                                        |
