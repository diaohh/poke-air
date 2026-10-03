# 15 — Phase 4 plan: Spanish (es-ES)

Plan and record of Phase 4 (roadmap in `09-roadmap.md`, architecture in `06-i18n.md`): the whole UI and
every Pokémon name in Spanish (Spain). Where it disagrees with `06`, this file is newer.

## Status (2026-09-28): implemented, pending manual validation

As with Phases 2–3, **no new unit tests yet** (§ Tests to add). Verified while building it: `pnpm check`
green (76 tests), `pnpm test:e2e` (English) passes, and a throwaway Playwright run (not committed)
went through a Spanish room: Home in Español → "Crear un combate" → lobby "Sala de combate", phones in
Spanish once seated, move picker finding "Terremoto" by "terremoto" and by "earthquake", editor
("Velo Arena", "Garchompita"), import, battle narration ("¡Pelipper ha usado **Protección**!",
"¡Reflejo está activo en el lado de Ben!"), chips "Lluvia · 4/5" / "Reflejo · 4/5", Pokémon sheet
("Restos", "Llovizna", "Fuerte (neutra)").

What was built (differences with the plan below in _italics_):

- `pnpm build:locales` (`packages/data/scripts/build-locales.ts`): downloads `data/text/es` at the pinned
  commit into `packages/data/.cache/` (git-ignored), writes `apps/web/public/data/names.es-ES.json`:
  1137 species, 934 moves, 317 abilities, 556 items, 25 natures (72 KB, **28 KB gzip**). Root `dev` /
  `build` run it after `build:data`; offline without a cache it only warns (names stay English).
  _Types and stats are not in it: they already were UI keys (`types.*`, `stats.*`)._
- Regional formes get "<base> de Alola / Galar / Hisui / Paldea"; untranslated Mega Stones follow the
  official pattern "-ite" → "-ita" ("Dragalgite" → "Dragalgita").
- `lib/dex-names.ts` `useDexNames()`: loads the locale's names once, `species / move / ability / item /
nature / effect(name)` with English fallback. Used by the team builder (cards, editor, pickers, nature
  picker, keep picker, error params), the phone battle (menu, moves, targets, party, sheets, summaries) and
  the Host (side cards, narration params, battle log, effect chips).
- `locales/es-ES/ui.json`: every key, _bundled_ like English (≈ 30 KB; lazy loading was not worth it) and
  type-checked against `en` (a missing key fails the typecheck). _Narration stat names have their own keys
  with articles (`battle.log.stats`: "el Ataque", "la Defensa") so Spanish lines read "¡Ha aumentado el
  Ataque de Garchomp!"._
- Language: outside a room the page follows the browser (any Spanish → es-ES) or the Home selector; a
  new room starts in the language the Host screen shows; seated phones follow the room.
- Pickers search the localized and the English names (and type / category names in both languages).
- Stays English (D-38): validator details and the Showdown import / export text.

### Feedback round 1 (2026-09-29, pending manual validation)

- **Spanish descriptions (D-62, replaces D-60):** Showdown has none, so `build:locales` also downloads
  PokeAPI's CSV dump at a pinned commit (`168b1e89…`, ~13 MB once, cached in `packages/data/.cache/`)
  and keeps the newest official in-game text in Spanish (Spain, language 7) for the roster:
  **moves 738 / 827, items 307 / 363, abilities 261 / 298** (the gaps are Gen 9 / Champions content,
  which falls back to English) → `desc.es-ES.json` (129 KB, 33 KB gzip), loaded lazily by the team
  builder and the move sheet only (`useDexDescriptions()`). The text is the games' flavor text ("Un
  terremoto que afecta a todos los Pokémon…"): official wording, less numeric than Showdown's.
- **Language menu:** own listbox instead of the native `<select>` (the OS drew its list, e.g. Windows'
  blue highlight); keyboard ↑ ↓ Enter Esc, click outside closes.
- **Room language (D-63):** stays a room setting the Host can change at any time (lobby or later).
  Technically cheap: one `room:state` broadcast, every screen re-renders from ids, and each device
  downloads a locale's names (28 KB gzip) once.
- **Shorter Spanish labels:** "Equipo red / blue", team count "2 / 2" (no word, never wraps),
  "Espacio libre", "¡Listo! (toca para cancelar)", "Cambiar" (switch), "Gestionar equipos" (phone
  Home; English "Manage teams"), wider code input on the Home ("CÓDIGO" fits).
- Trainer names use the official Spanish ones where certain (Cintia, Máximo, Plubio, Lionel…); Kieran and
  Carmine keep their names until confirmed.

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
| Descriptions (`shortDesc`/`desc`) | **0 %** for species, moves, items and abilities → Spanish descriptions come from PokeAPI instead (D-62)                                                                                                                                                                                                                    |
| `default.ts` battle messages      | 85 / 109; `null`: `startBattle`, `turn`, `mega`, `startFieldEffect`, item messages… (Showdown's own templates)                                                                                                                                                                                                             |

Files are TypeScript object literals (`name: null, // NEEDS TRANSLATION` marks gaps): the build script can
download them at the pinned commit and load them with `tsx` (type annotations only, no imports). Names
only, as JSON: **~58 KB** (≈ 20 KB gzip).

### Decisions (confirmed while building Phase 4, recorded in `08-decisions.md`)

- **D-58** Battle narration keeps **our own keys** (`battle.log.*`), translated in
  `locales/es-ES/ui.json`; names inside them are localized by Showdown id. No Showdown template engine /
  `BattleTextFormatter` and no `@pkmn/view` (its tables don't cover the Champions mod either). Showdown's
  `default.ts` is a wording reference for our Spanish lines.
- **D-59** `pnpm build:locales` (packages/data) downloads `data/text/es` at a pinned commit into a
  git-ignored cache and writes `apps/web/public/data/names.es-ES.json` (species / moves / abilities /
  items / natures by Showdown id; missing ids fall back to English on the client). Rules in the script:
  regional formes = translated base + "de Alola…", untranslated Mega Stones "-ite" → "-ita".
- **D-60** _(superseded by D-62 for descriptions)_ Descriptions (moves, abilities, items) and validator details stay English in es-ES for v1;
  the `INVALID_SET` message says the details are in English. PokeAPI flavor text is a later option.
- **D-61** UI texts for every locale are bundled and type-checked against English. Outside a room the
  page follows the browser language (any Spanish → es-ES) or the Home selector; a new room starts in
  the language the Host screen shows; seated phones follow the room locale.

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

### Feedback round 2 (2026-09-29, pending manual validation)

- **Substitute is shown:** it always worked in the simulator (HP paid, hits absorbed, `-end` when it
  breaks) but the Host ignored its lines, so hits seemed to do nothing. Now: narration ("X put in a
  substitute!", "The substitute took damage for X!", "X's substitute faded!", a blocked status move =
  "But it failed!"), the doll replaces the sprite (Showdown's gen5 doll, self-hosted by
  `pnpm fetch:sprites`, drawn 1.6× and grounded on the platform), a "Substitute" tag on the side card,
  and on the phone (active card, target cards) through `BattleFieldSlot.substitute`.
- **Protect is narrated:** `@pkmn/protocol` turns `-activate … move: Protect` into `-block`, which the
  model never handled since Phase 1 ("X protected itself!" was never shown). Fixed.
- **Stat changes stand out:** a floating badge over the Pokémon for each change ("▲ Attack +2" green /
  "▼ Defense −1" red, rises and fades in 1.4 s), colored glow on the boost / unboost animations,
  side card stages as green ▲ / red ▼ tags with short names ("▲ ATK +2"), and the same tags on the
  phone's active card while choosing.

## Tests (added 2026-10-03, see `16-first-deploy.md`)

Added:

- web (`model.test.ts`): Substitute `-start` / `-activate [damage]` / `[block]` / `-end`, cleared on
  switch and faint; `-block` (Protect); boost events with the signed change, clamped to ±6, reset on
  switch. `i18n/locales.test.ts`: es-ES has exactly the keys of `en`, the same `{{params}}`, no empty
  strings.
- data (`packages/data/scripts/lib/locales.test.ts`; the pure rules moved to `lib/locales.ts`):
  translated entries only, regional formes, Mega Stone pattern (Showdown's own name wins), newest
  flavor text per language as one paragraph, `parseCsv` (quoted commas, quotes, newlines, CRLF).
- E2E: `e2e/spanish.spec.ts`, the Host switches the lobby to Español, phones follow, battle log and
  results in Spanish.

Still to add: `build:locales` I/O (skip when current, offline warning), `LanguageSelect`,
`useDexNames` / `useDexDescriptions` fallbacks and `effect()` order, `browserLocale`,
`NarrationText`, bilingual picker search.

## Manual validation checklist

1. Host: switch the room to Español in the lobby → Host and phones change live.
2. Team builder in Spanish: species / moves / items / abilities / natures / types; search "terremoto" and
   "earthquake" both find Earthquake.
3. Battle narration, battle log and field chips in Spanish with Spanish names; results screen.
4. Forme names ("Raichu de Alola"), Mega Stones without translation fall back to English.
5. Import / export text stays in English and round-trips.
