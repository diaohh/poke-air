# 11 — Phase 1 implementation plan: playable MVP (singles 1v1)

Self-contained plan for the next development session. Read `CLAUDE.md`, `docs/10-development.md` and the
"Verified simulator facts" table in `docs/05-game-rules-and-mechanics.md` first.

## Goal and definition of done

Two people, each with a phone, play a **complete singles 1v1 battle** on the local network:
lobby → random teams → battle on the Host screen with private controls on phones → results → rematch.

Done when all of these hold:

1. Host creates a room; two phones join via QR; teams red/blue; Start → TEAM_BUILDING.
2. Each phone can randomize its team (6 Pokémon in singles), reroll single slots, remove slots, and mark Ready.
3. When every player is Ready (≥ 1 Pokémon each), the battle starts automatically after a 3 s countdown on the Host.
4. The Host renders the battle (sprites, HP bars, status, narration, generic animations) from the
   **spectator stream only**.
5. Each phone shows **only its own** options: moves (with type, PP, disabled state), Mega toggle, switches,
   forced switches after a faint; waiting state with undo; forfeit with confirmation.
6. Phones only get their next menu after the Host finished animating the turn (or 15 s timeout).
7. Turn timer (60 s) auto-completes missing choices with `default`.
8. Results screen on Host and phones; Rematch (same teams → TEAM_BUILDING) and Back to lobby work.
9. Refreshing the Host or a phone mid-battle restores the current state (log replay / request resend).
10. `pnpm check` passes; new logic in `packages/core` is unit-tested; new events have integration tests.

Out of scope for Phase 1: team editor (Phase 2), doubles/OwnershipLayer merging (Phase 3), Spanish
(Phase 4), fancy animations/audio (Phase 5), deployment (do it whenever convenient; nothing blocks it).

## Decisions already taken for Phase 1

| Topic                   | Decision                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Format id               | `gen9championscustomgame@@@!Team Preview` (constant in `core/battle/showdown.ts`)                                                                            |
| Random sets             | `Teams.generate('gen9championsrandombattle')`, force `level: 50`, keep SP in `evs` as-is                                                                     |
| Species Clause          | Enforced by TeamService across the whole side (by `baseSpecies`)                                                                                             |
| Validation              | Randomizer output is trusted in Phase 1 (no `TeamValidator` yet; `Obtainable` rejects some event forms — spike S3 in Phase 2)                                |
| Side mapping            | red → `p1`, blue → `p2`; side name = the team's player names joined with " & "                                                                               |
| Mega                    | Singles = one human per side, so the sim default (one Mega per side) already equals "one per player". No `runMegaEvo` override until Phase 3                 |
| Battle start            | Automatic when all players are Ready; 3 s countdown shown on Host (a player un-readying cancels it)                                                          |
| Host battle model       | `@pkmn/protocol` for parsing + our own reducer. **Not** `@pkmn/client` (its dex lacks the Champions mod)                                                     |
| Move metadata on phones | **Server enriches** each request move with `type`, `category`, `basePower`, `accuracy` from `Dex.mod('champions')`, so phones don't need dex data in Phase 1 |
| Timer                   | 60 s per request; on expiry send `default` for that side                                                                                                     |
| Sprites                 | `gen5ani` front/back via `@pkmn/img` URLs with our own `domain`; downloaded by `pnpm fetch:sprites`                                                          |

## Work packages (suggested order)

### WP1 — Readiness and team state in the Room (`packages/core`, `packages/shared`)

- `shared`: add `PokemonSetData` (JSON-safe subset of Showdown's `PokemonSet`):
  `{ name, species, item, ability, moves: string[], nature?, gender?, evs: StatTable, ivs?: StatTable, level, shiny? }`.
  `shared` must not import `pokemon-showdown` (web imports `shared`).
- `PublicPlayer` gains `ready: boolean` and `teamCount: number` (count only — species stay private).
- `Room`: `teams: Map<playerId, (PokemonSetData | null)[]>` sized to the player's quota;
  `quotaFor(playerId)` = `POKEMON_PER_TEAM / playersOnTeam` (6 in singles);
  `setSlot(playerId, slot, set | null)`, `setReady(playerId, ready)` (TEAM_BUILDING only, needs ≥ 1 Pokémon;
  any team change un-readies the player), `allReady()`, `startBattle()` (TEAM_BUILDING → BATTLE),
  `finishBattle(result)` (BATTLE → RESULTS), `rematch()` (RESULTS → TEAM_BUILDING, keeps teams, clears ready).
- On entering TEAM_BUILDING, trim/extend each player's slots to their quota.
- Unit tests for every transition and guard.

### WP2 — TeamService (`packages/core/src/team/`)

- `randomSets(count, { excludeBaseSpecies })`: loop `Teams.generate(SHOWDOWN_FORMATS.randomSets)`, skip
  base species already used on the side (Species Clause), force level 50, map to `PokemonSetData`
  (drop `role`/`speciesId`). Deterministic in tests via an injectable generator.
- Events (`/player`):
  - `team:randomize { slots?: number[] }` — no `slots` → reroll the whole team; with `slots` → reroll those.
  - `team:setSlot { slot, set: null }` — Phase 1 only accepts `null` (remove). Phase 2 accepts sets + validation.
  - `player:ready { ready: boolean }`.
  - Server → owner only: `team:state { quota, slots: (PokemonSetData | null)[] }`, sent after each change,
    on join/rejoin, and when entering TEAM_BUILDING.
- Controller UI (`controller/team-builder/`): quota-sized grid of cards (sprite, species, item, 4 moves);
  per-card 🎲 and ✕; "Randomize team" button; big Ready toggle. Ready disabled with 0 Pokémon.
- The cards need Pokémon sprites: do the **sprite download extension described in WP5 at this point**
  (or show the species name only until WP5). Add `@pkmn/img` to `apps/web` and `packages/data`.
- Host UI: player cards with `teamCount/quota` and a Ready badge; countdown overlay when everyone is ready.

### WP3 — BattleSession (`packages/core/src/battle/`)

```ts
class BattleSession {
  constructor(opts: {
    formatId: string;
    sides: Record<'p1' | 'p2', { name: string; team: PokemonSetData[] }>;
    onSpectator: (lines: string[]) => void; // public log chunk → Host
    onRequest: (side: SideId, request: ShowdownRequest) => void;
    onChoiceError: (side: SideId, message: string) => void; // `|error|[Invalid choice] …`
    onEnd: (result: { winner: SideId | null; reason: 'normal' | 'forfeit' }) => void;
  });
  choose(side: SideId, choice: string): void; // writes `>p1 <choice>`
  undo(side: SideId): void; // `>p1 undo`
  forfeit(side: SideId): void; // `>forcelose p1`
  readonly spectatorLog: string[]; // full public log for Host resync
  readonly inputLog: string[]; // for deterministic recovery (later)
  currentRequest(side: SideId): ShowdownRequest | undefined; // resend on rejoin
  destroy(): void;
}
```

- Built on `BattleStream` + `getPlayerStreams` (see `showdown.test.ts` for the working pattern).
- Parse `|request|<json>` from the player streams; ignore `wait: true` requests for UI purposes but keep
  them as the current request. Handle `forceSwitch` and `teamPreview` (should not occur with `!Team Preview`).
- Detect the end with `/^\|(win\||tie$)/m` on the spectator stream (never `includes('|tie')`).
- `TurnTimer` (injectable clock): starts when a side gets an actionable request; on expiry → `choose(side, 'default')`.
- `OwnershipLayer` in Phase 1 is the identity mapping (one human per side), but give it the Phase 3
  interface: `requestFor(playerId, sideRequest)` and `mergeChoices(side, partialChoices)`.
- Tests: scripted battles (fixed teams, explicit choices), forfeit, timer expiry, invalid choice, rejoin resend.

### WP4 — Battle transport (`apps/server/src/transport/battle-handlers.ts`)

- When `room.allReady()` → countdown (3 s, cancellable) → create `BattleSession`, `room.startBattle()`, broadcast.
- Host: `battle:log { from: number; lines: string[] }` (append-only; `from` = index of the first line).
  `host:resumeRoom` ack gains `battleLog?: string[]` so a refreshed Host rebuilds the scene.
- Phones: `battle:request { request: EnrichedRequest }` (moves enriched with type/category/basePower/accuracy).
  Resend the current request on rejoin. Define `EnrichedRequest` (and the other battle payload types) as a
  **hand-written subset** in `packages/shared/src/battle.ts`, based on the request shape recorded in
  `docs/05` ("Verified simulator facts"). `shared` must not import `pokemon-showdown`; `core` maps the
  sim's objects to these types.
- `battle:choose { choice: string }` — zod: `^(move [1-4]( mega)?|switch [1-6]|default)$` in Phase 1
  (targets arrive in Phase 3). Sim rejections → `battle:choiceRejected { message }` to that phone.
- `battle:undo {}`, `battle:forfeit {}`.
- `host:turnAnimated { turn }` releases held requests; 15 s fallback timer releases them anyway.
- `battle:waiting { waitingFor: playerId[]; deadline: number | null }` to both namespaces.
- `battle:end { winner: TeamId | null; reason }` + `room:state` (RESULTS).
- `host:rematch {}` → `room.rematch()`; `host:backToLobby` also allowed from RESULTS.
- Integration test: two phones play a battle with `default` choices to the end.

### WP5 — Host battle scene (`apps/web/src/host/battle-scene/`)

- `HostBattleModel` (pure reducer, unit-tested with recorded logs): players, active Pokémon per side
  (species from `details`, HP as `cur/100` from the spectator stream, status, boosts, Mega), field
  (weather, terrain, side conditions), turn number, winner.
- Protocol subset to handle first: `player`, `teamsize`, `switch`/`drag`/`replace`, `move`, `-damage`, `-heal`,
  `-sethp`, `faint`, `-status`, `-curestatus`, `-boost`/`-unboost`/`-clearboost`, `-weather`,
  `-fieldstart`/`-fieldend`, `-sidestart`/`-sideend`, `-mega`, `-supereffective`, `-resisted`, `-crit`,
  `-miss`, `-immune`, `-fail`, `cant`, `turn`, `win`, `tie`. Unknown lines are ignored.
- `AnimationQueue`: consumes events sequentially (≈ 400–900 ms each), updates the rendered model step by
  step, and emits `host:turnAnimated(turn)` when a turn's events are drained.
- Layout on the 1920×1080 `Stage`: red side = back sprite bottom-left, blue side = front sprite top-right,
  trainers, HP bars (green/yellow/red), status chips, Poké Ball row per player, narration box, turn counter,
  "choosing…/ready" badges from `battle:waiting`, timer.
- Generic animations (CSS/Web Animations): physical lunge, special projectile tinted by move type, status
  glow, damage flash, faint fade-out, switch Poké Ball, Mega glow.
- Narration: English i18n keys under `battle.*` with interpolation (`battle.used`, `battle.superEffective`,
  `battle.fainted`, `battle.megaEvolved`, `battle.won`…). Pokémon/move names in English for now.
- Sprites: extend `packages/data/scripts/fetch-sprites.ts` to download `gen5ani` front + back for every
  species the randomizer can produce (enumerate the Champions random sets data or the Champions dex),
  using `Sprites.getPokemon(species, { gen: 'gen5ani', side })` from `@pkmn/img` to compute the URL. At
  runtime call it with `{ protocol, domain }` pointing to our own host. Check coverage of new Megas.

### WP6 — Controller battle UI (`apps/web/src/controller/battle/`)

- Active Pokémon header (species, exact HP from `side.pokemon[].condition`, status).
- Fight: 4 move buttons (name, type color, PP `pp/maxpp`, disabled), Mega toggle when `canMegaEvo`.
- Switch: bench from `side.pokemon` (not active, not fainted — `condition` ends with ` fnt`).
- Forced switch screen when `forceSwitch`.
- After choosing: "Waiting for your opponent…" + Undo. Watch-the-screen state while the Host animates.
- Forfeit with confirmation. Vibrate on new request (`navigator.vibrate`, optional).

### WP7 — Results and rematch

- Host: winning team banner with trainers, simple stats (KOs per player from the log), Rematch / Back to lobby.
- Phones: result + "waiting for host".

### WP8 — Hardening

- Rate limiting `player:join` per IP (simple token bucket in the server) and max rooms per IP.
- Mid-battle reconnection tests (phone and Host refresh).
- Playwright E2E script (1 Host + 2 mobile contexts) that plays a battle with `default` choices. Add
  `@playwright/test` as a root dev dependency; prefer `channel: 'msedge'`/`'chrome'` to avoid browser downloads.

## Suggested new i18n key groups

`teamBuilder.*`, `battle.*` (narration + controller labels), `results.*`, `types.*` (18 type names),
`errors.*` (new codes: `NOT_READY_ALLOWED`, `EMPTY_TEAM`, `INVALID_CHOICE`, `NO_ACTIVE_BATTLE`, …).

## Risks to watch in Phase 1

- `gen5ani` sprites missing for the newest Megas/forms → fall back to `ani`/`home`/static and log them.
- Long animation queues making the game feel slow → keep durations short; allow skipping with a Host key.
- Showdown request edge cases (Transform, Illusion, Zoroark-Hisui, trapped, disabled moves) → trust the
  request flags (`disabled`, `trapped`, `maybeTrapped`) instead of re-deriving rules.
