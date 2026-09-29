# 15 — Phase 4 plan: Spanish (es-ES)

Plan for Phase 4 (roadmap in `09-roadmap.md`, architecture in `06-i18n.md`). **Not implemented yet**:
agreed on 2026-09-28 to validate Phases 2–3 and the Phase 3 feedback round first. This file holds the
spike S4 results and the implementation plan. Where it disagrees with `06`, this file is newer.

## Status (2026-09-28): planned — spike S4 done

## Spike S4 results (i18n part)

Showdown's translated tables live in the **GitHub repo only** (`data/text/es/*.ts`), not in the npm
release 0.11.11. Measured at commit **`a5df8274e85b`** (master, 2026-09-23) against the Casual roster
built by `buildTeamBuilderData()`:

| Table (`data/text/es`)            | Coverage for Poke-Air                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pokedex.ts` species names        | **998 / 1234 (81 %)**. The 236 gaps are formes: 129 have a translated base species (regional / cosmetic formes → base name + our forme suffix table: "de Alola", "de Galar", "de Hisui", "de Paldea"…); 107 have no entry at all (Giratina, Landorus, Vivillon…, whose Spanish name is the English one) → English fallback |
| `moves.ts` names                  | **827 / 827 (100 %)**                                                                                                                                                                                                                                                                                                      |
| `abilities.ts` names              | **298 / 298 (100 %)**                                                                                                                                                                                                                                                                                                      |
| `items.ts` names                  | **282 / 363 (78 %)**: the gaps are mostly Mega Stones (incl. the new Champions ones) → English fallback + overrides where the official name is known                                                                                                                                                                       |
| `names.ts`                        | Natures 25 / 25, types 18 / 18, stats (long / short), statuses partial (`slp`, `frz` missing) — keys are **capitalized** (`Adamant`, `Bug`)                                                                                                                                                                                |
| Descriptions (`shortDesc`/`desc`) | **0 %** for species, moves, items and abilities → descriptions stay English in v1 (as `06` foresaw)                                                                                                                                                                                                                        |
| `default.ts` battle messages      | 85 / 109; `null`: `startBattle`, `turn`, `mega`, `startFieldEffect`, item messages… (Showdown's own templates)                                                                                                                                                                                                             |

Files are TypeScript object literals (`name: null, // NEEDS TRANSLATION` marks gaps): the build script can
download them at the pinned commit and load them with `tsx` (type annotations only, no imports). Names
only, as JSON: **~58 KB** (≈ 20 KB gzip).

### Decisions from the spike (proposed, to confirm when starting Phase 4)

- **D-58 (proposed)** Battle narration keeps **our own keys** (`battle.log.*`), translated in
  `locales/es-ES/ui.json`; names inside them are localized by Showdown id. No Showdown template engine /
  `BattleTextFormatter` and no `@pkmn/view` (its tables don't cover the Champions mod either). Showdown's
  `default.ts` is a wording reference for our Spanish lines.
- **D-59 (proposed)** `pnpm build:locales` (packages/data) downloads `data/text/es` at a pinned commit
  into a git-ignored cache and writes `apps/web/public/data/names.es-ES.json` (species / moves / abilities
  / items / natures / types / stats by Showdown id, English fallback omitted = lookups fall back). Forme
  names without a translation = translated base name + our forme suffix table; overrides in
  `packages/data/locales/es-ES/overrides.json`.
- **D-60 (proposed)** Descriptions (moves, abilities, items) stay English in es-ES for v1, marked in the UI
  only where it helps ("(EN)"); PokeAPI flavor text is a later option.

## Implementation plan

1. **data:** `scripts/build-locales.ts` (pinned commit constant, cache dir, stamp like `build:data`),
   forme suffix table + overrides, output `names.<locale>.json`. Root `dev` / `build` run it after
   `build:data` (skips when current).
2. **shared:** `SUPPORTED_LOCALES = ['en', 'es-ES']`, `LOCALE_NAMES_URL(locale)`.
3. **web i18n:** `locales/es-ES/ui.json` (every key; typed against `en`), lazy load per room locale,
   Host language selector enables Español, Host default = browser language when supported.
4. **web names:** `lib/dex-names.ts` (`useDexNames()`: loads the locale's names JSON once; `speciesName(id)`,
   `moveName(id)`… falling back to the English name) used by: team builder (pickers, cards, editor),
   phone battle (moves, Pokémon, items, abilities, targets, summaries), Host (side cards, narration params,
   battle log, field chips, results). Narration params become ids + English names; the Host resolves
   the display name when rendering.
5. **search:** pickers match the localized **and** the English name (`searchKey` over both).
6. **stays English:** Showdown import / export text, `INVALID_SET` validator details (D-38), descriptions.
7. **docs:** `06` (measured coverage, final architecture), `02`, `10`, `12`, `CLAUDE.md`, this file.

## Manual validation checklist (when built)

1. Host: switch the room to Español in the lobby → Host and phones change live.
2. Team builder in Spanish: species / moves / items / abilities / natures / types; search "terremoto" and
   "earthquake" both find Earthquake.
3. Battle narration, battle log and field chips in Spanish with Spanish names; results screen.
4. Forme names ("Raichu de Alola"), Mega Stones without translation fall back to English.
5. Import / export text stays in English and round-trips.
