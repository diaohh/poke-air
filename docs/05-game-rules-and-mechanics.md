# 05 — Game rules and mechanics

## Target: a Pokémon Champions–style format

Pokémon Champions (Nintendo Switch, released April 8, 2026; the official VGC 2026 platform) standardizes
competitive battling to balance teams:

| Mechanic       | Champions                                                                                  | Poke-Air MVP                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Level          | All stats computed at **level 50**                                                         | ✅ Level 50                                                                                                              |
| IVs            | Removed: stats computed as if **31 in every stat**                                         | ✅ No IVs (fixed 31, no editor)                                                                                          |
| EVs            | Replaced by **Stat Points (SP)**: 66 per Pokémon, max 32 per stat, +1 stat per SP at Lv 50 | ✅ Stat Points                                                                                                           |
| Natures        | Kept                                                                                       | ✅                                                                                                                       |
| Battle gimmick | **Mega Evolution only** (one per battle, needs the Mega Stone)                             | ✅ Mega only, **one per player** (team parity in 1v2; see `04-battle-modes.md`). Tera/Dynamax/Z later as ruleset options |
| PP             | Capped at 20                                                                               | ✅ (comes with the mod)                                                                                                  |
| Roster         | Limited official roster                                                                    | ⚠️ Poke-Air: **all Pokémon fully implemented** in the sim (see below)                                                    |

### Showdown already implements this

Pokémon Showdown added Champions formats on **April 11, 2026** (`[Gen 9 Champions] OU`, `VGC 2026 Reg M-*`,
`BSS`, `Random Battle`, `Random Doubles Battle`, `Custom Game`…), backed by
`data/mods/champions` in the MIT server repo. Verified in source:

- `scripts.ts → statModify`: computes stats with IV 31 baked in and reads **Stat Points from `set.evs`**
  (so a set's `evs` field holds SP values, not EVs).
- `scripts.ts → canTerastallize()` returns `null` → **Tera is disabled**; `canMegaEvo` supports Megas,
  including the new Mega Stones.
- `init()`: caps every move's PP at 20.
- `rulesets.ts`: Champions versions of `Standard AG`, `Standard`, `Flat Rules` (VGC-style), plus
  `NatDex Mod` (`+Unobtainable`, `+Past`), used by `[Gen 9 Champions] NatDex Draft`.

→ **Poke-Air doesn't implement these mechanics; it selects the `champions` mod and composes rules.**

### Roster: "every Pokémon with defined mechanics"

The Champions roster is restricted. Poke-Air wants every species that is fully implemented in the sim.
Plan: Champions mod + **`NatDex Mod`** rule (allows `Past`/`Unobtainable` species) while excluding
non-standard content (CAP, LGPE-only, custom/fakemon). Spike S3 must verify:

- Learnset validation for species outside the Champions roster (NatDex Draft does this by falling back
  to the National Dex validator — we reuse that approach).
- Whether Z-Crystals / other past gimmick items become legal under `+Past` and must be banned
  explicitly (goal: Mega only).

✅ **Spike S3 done (2026-09-28)** — details in `13-phase-2-plan.md`. The Casual validator is
`gen9championsnatdexdraft@@@!Nickname Clause, !OHKO Clause, !Evasion Clause, !Sleep Clause Mod, Z-Move Clause`
used **per set** (decision D-35): NatDex Draft's own `checkCanLearn` falls back to National Dex learnsets,
so Champions-roster species keep their full movepool and every other species validates too. Z-Crystals
were legal under `+Past` → banned with `Z-Move Clause`. Legal roster: **1234 species/formes**. Team size and
Species Clause across teammates are enforced by `Room`, not by the validator.

## Ruleset presets

Showdown's format system composes rules (`ruleset`, `banlist`, `unbanlist`, value rules such as
`Adjust Level = 50`, `Item Clause = 1`, `Min Team Size = 1`). This makes presets **cheap**: a preset is
just a base format + a list of rules. Internally the code models rulesets from day one (cheap), but
**v1 ships a single ruleset ("Casual") with no selector in the lobby**. Any extra restriction
(e.g. "no legendaries") is a verbal agreement between players. A lobby rules UI is a later feature.

```ts
// packages/core/rulesets (sketch)
interface RulesetPreset {
  id: 'casual' | 'vgc' | string;
  labelKey: string; // i18n key
  mod: 'champions';
  rules: string[]; // Showdown rule names
  bans: string[];
  gimmicks: { mega: boolean; tera: boolean; zMove: boolean; dynamax: boolean };
}
```

| Preset                       | Phase   | Rules (Showdown terms)                                                                                                                                                                                                                                             |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Casual ("anything goes")** | **MVP** | Champions mod · `NatDex Mod` · `Adjust Level = 50` · `Species Clause` · `Obtainable` (moves/abilities) · `Cancel Mod` · `Min Team Size = 1` · no Item Clause · legendaries allowed · `Z-Move Clause`. Implemented as the S3 validator format above + `Room` checks |
| **VGC-style**                | Later   | Champions `Flat Rules`: `Item Clause = 1`, no Mythical/Restricted Legendary, Lv 50, team preview + bring 6 pick 4 (doubles)                                                                                                                                        |
| Custom                       | Later   | Toggles in the Host lobby (Item Clause, legendaries, Tera on/off…)                                                                                                                                                                                                 |

Notes:

- Showdown's Champions `Standard AG` includes `Min Team Size = 6`; Poke-Air overrides it (players may bring fewer).
- "Bring 6 pick 4" requires a team preview/pick phase → not in MVP.
- Tera/Dynamax/Z-Moves as future options would require a different mod or custom scripts; out of scope for v1.

## Other defaults

| Setting                 | Singles      | Doubles                                                    |
| ----------------------- | ------------ | ---------------------------------------------------------- |
| Species Clause          | per team     | per team                                                   |
| Legendaries / Mythicals | allowed      | allowed                                                    |
| Mega Evolution          | 1 per player | 1 per player (team parity in 1v2), max 1 per team per turn |
| Team preview            | no           | no (later with VGC preset)                                 |
| Turn timer              | 60 s         | 90 s (can be disabled)                                     |

## Randomizer

- Uses Showdown's **Champions random set generators** (`[Gen 9 Champions] Random Battle` for singles,
  `Random Doubles Battle` for doubles) → competitively viable sets built for Champions mechanics.
  ⚠️ The npm release 0.11.11 only ships the **singles** Champions random generator
  (`gen9championsrandombattle`); Champions Random Doubles exists on GitHub master only. v1 uses the singles
  sets for both formats (they are valid in doubles, just not doubles-optimized) until a newer npm release.
- Random Battle formats use `Level Clause Mod` (levels scaled per Pokémon). Poke-Air **forces level 50**
  on generated sets to keep the rule consistent (slightly less balanced than the original levels, accepted).
- Quota-aware: generates 6 or 3 sets per player and respects Species Clause across the whole team
  (teammates can't duplicate a species already picked by an ally).
- Later: Smogon sample sets per tier as an alternative source.

## Verified simulator facts (pokemon-showdown 0.11.11, September 2026)

Checked with scripts against the installed package; re-verify after upgrading.

| Fact                                                                                                                                                                                                                        | Consequence for Poke-Air                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Champions random sets store **Stat Points in `evs`** (per-set totals 55–66, never above 66)                                                                                                                                 | Sets can be used as-is; the team editor edits SP in the `evs` field                                                                                                                                                                  |
| Random sets come with **levels 47–58** (`Level Clause Mod`)                                                                                                                                                                 | Force `level: 50` on every generated set                                                                                                                                                                                             |
| Random sets include Mega Stones and new Megas (e.g. `Floettite`, `Dragalgite`)                                                                                                                                              | Randomized teams already exercise Mega Evolution                                                                                                                                                                                     |
| Custom rules via `@@@` work: `gen9championscustomgame@@@!Team Preview, Species Clause`                                                                                                                                      | Rulesets are format id + custom rules; **v1 singles/doubles must add `!Team Preview`** (the Champions custom games enable Team Preview by default)                                                                                   |
| `TeamValidator` on Champions formats enforces SP limits ("more than 32 Stat Points in HP", "80 total … limit of 66")                                                                                                        | Phase 2 editor validation comes for free                                                                                                                                                                                             |
| `Obtainable` rejects event-only forms at level 50 (e.g. "Floette-Eternal must be at least level 72")                                                                                                                        | Resolved in S3: the Casual validator (NatDex Draft + `Adjust Level = 50`) accepts them at Lv 50; randomizer output passes (0 / 360 rejected)                                                                                         |
| `>forcelose p1` ends the battle (`\|win\|<p2 name>`)                                                                                                                                                                        | Implements `battle:forfeit`                                                                                                                                                                                                          |
| First `request` for singles: `{ active: [{ moves: [{ move, id, pp, maxpp, target, disabled }], canMegaEvo }], side: { name, id, pokemon: [{ ident, details, condition, active, stats, moves, baseAbility, item, … }] } }`   | Controller battle UI data model                                                                                                                                                                                                      |
| The spectator stream starts with `\|tier\|…` — naive `includes('\|tie')` end detection is wrong                                                                                                                             | Detect the end with `/^\|(win\|\|tie$)/m` (BattleSession uses `battle.ended`)                                                                                                                                                        |
| Champions **custom games are `debug` formats**: spectators get exact HP (`136/136`) and `\|debug\|` lines (damage rolls, random checks)                                                                                     | Patch the battle instance right after `>start`: `reportExactHP = false`, `debugMode = false` → spectators get `N/100` (Champions floors the %, with `y`/`r`/`g` color hints at 20/50 %); each side keeps its exact HP in its request |
| `Battle` (exported) takes a synchronous `send(type, data)` callback; `choose()` returns `false` and emits `\|error\|[Invalid choice] …` on rejection; `sendUpdates()` emits the `update` chunk **before** the side requests | BattleSession uses `Battle` directly: synchronous acks, guaranteed log → request order                                                                                                                                               |
| `lose()` / `win()` don't flush: call `sendUpdates()` after them (BattleStream does it after every write)                                                                                                                    | Every BattleSession call flushes                                                                                                                                                                                                     |
| Requests carry **no `rqid`** (Showdown's server adds it); hidden info revealed mid-choice re-sends the same request with `update: true` (`[Unavailable choice]`)                                                            | BattleSession numbers requests itself; `update` requests keep their id                                                                                                                                                               |
| Choices only reach `inputLog` when the turn commits                                                                                                                                                                         | Replays/recovery use committed turns only                                                                                                                                                                                            |
| `extractChannelMessages` is not exported; a `\|split\|pN` line is followed by the secret and the public version                                                                                                             | BattleSession splits channels with the same regex                                                                                                                                                                                    |
| 12 new Champions Megas (e.g. Dragalge-Mega, Scolipede-Mega, Raichu-Mega-X/Y) have **no sprite** on Showdown yet; many others only as static `gen5`                                                                          | Sprite manifest + base-forme fallback (D-30)                                                                                                                                                                                         |
| `Min Team Size = 1` can't override Standard AG's `Min Team Size = 6` in `gen9championsnatdexdraft` custom rules                                                                                                             | Validate with `validateSet` per Pokémon; team size and Species Clause are `Room` rules                                                                                                                                               |
| Plain `gen9championscustomgame@@@NatDex Mod` validates, but roster species only get their **Champions learnset** (e.g. Garchomp can't learn Aqua Tail)                                                                      | Use the NatDex Draft format (its `checkCanLearn` falls back to National Dex learnsets)                                                                                                                                               |
| Z-Crystals are legal under `+Past`; `Z-Move Clause` bans them                                                                                                                                                               | Part of the Casual validator (Mega only)                                                                                                                                                                                             |
| The validator rejects 0 Stat Points with the default nature ("did you forget to invest…?")                                                                                                                                  | `TeamService.validateSet` uses Hardy (also neutral) when no nature is set and SP total is 0                                                                                                                                          |
| The validator normalizes sets in place (e.g. `Charizard-Mega-X` → `Charizard` holding its stone)                                                                                                                            | Validated sets are read back after `validateSet`                                                                                                                                                                                     |
| Champions stats (`statModify`, no Level Clause): `HP = base + SP + 75`, others `floor((base + SP + 20) × nature)`                                                                                                           | The phone previews stats with the same formula (`lib/stats.ts`)                                                                                                                                                                      |
| Weather / terrain / screens last 5 turns (8 with the extending item), Trick Room / Gravity / Safeguard 5, Tailwind 4 (`duration` + `durationCallback`)                                                                      | Durations sent to the Host from the dex (`battle:log.effects`)                                                                                                                                                                       |
| `getMovePool` on the Champions dex only knows the Champions learnset for its roster                                                                                                                                         | The builder data unions it with `Dex.mod('gen9')`'s National Dex movepool, then validates each move                                                                                                                                  |
| Champions `canMegaEvo` only allows a Mega by move (`requiredMove`: Rayquaza + Dragon Ascent) when the format has `+tag:past`; a Z-Crystal blocks it. Verified: `@@@!Team Preview,+Past` → `canMegaEvo: true`, `             | -mega                                                                                                                                                                                                                                | p1a: Rayquaza | Rayquaza | `   | Battle format ids include `+Past` (D-41); `+tag:past` is only read by Mega logic in the sim |
| `Battle` does not trim custom rules: `@@@!Team Preview, +Past` throws `Rule " +Past" should be trimmed` (`TeamValidator.get` does trim)                                                                                     | No spaces after commas in battle format ids                                                                                                                                                                                          |
