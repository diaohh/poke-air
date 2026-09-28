# 03 — Data sources and licensing

> ⚠️ Technical analysis, not legal advice. Verified against the official repos/registries in September 2026.

## Executive summary

| Need                                                                                               | Recommended source                                                                    | License                                                              |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Battle mechanics** (damage, abilities, items, weather, turn order, Mega Evolution, spread moves) | `pokemon-showdown` (npm, official)                                                    | MIT                                                                  |
| Champions mechanics (Lv 50, IVs fixed, Stat Points, Mega only, PP cap)                             | `pokemon-showdown` → `data/mods/champions`                                            | MIT                                                                  |
| Dex for mechanics (stats, types, moves, learnsets, legality per format)                            | `pokemon-showdown` `Dex` / `Dex.mod('champions')`                                     | MIT                                                                  |
| "Meta" random sets                                                                                 | `pokemon-showdown` random team generators (Champions Random Battle)                   | MIT                                                                  |
| Import/export Showdown text                                                                        | `pokemon-showdown` `Teams` or `@pkmn/sets`                                            | MIT                                                                  |
| Battle log parsing on the Host                                                                     | `@pkmn/protocol` + our own reducer                                                    | MIT                                                                  |
| Sprite/icon/trainer URLs                                                                           | `@pkmn/img` (code)                                                                    | MIT (the images are not)                                             |
| **Translations** (names, battle messages, some descriptions)                                       | Showdown server repo `data/text/<lang>/`                                              | MIT (texts sourced from PokeAPI + official game text)                |
| Extra flavor text (fallback)                                                                       | **PokeAPI** (build time only)                                                         | Open source; fair-use policy                                         |
| Pokémon sprites                                                                                    | Showdown sprite server (download once) or `PokeAPI/sprites` (has a `showdown` folder) | © Nintendo/Game Freak/TPC + fan sprites by the Smogon Sprite Project |
| Trainer sprites (Cynthia, Lance…)                                                                  | Showdown `/sprites/trainers/`                                                         | © Nintendo/Game Freak/TPC + fan artists                              |

**Conclusion:** Showdown is the **single source of truth** for mechanics, data and even most translations.
PokeAPI becomes an optional fallback. Sprites are **self-hosted**.

## Pokémon Showdown: what we can use

The project has **two repos with different licenses**:

### `smogon/pokemon-showdown` — server and simulator → **MIT** ✅

- Usable as a library, modifiable and redistributable, even in closed projects, keeping the copyright notice.
- Includes: simulator (`sim/`), data (`data/`: species, moves, items, abilities, learnsets, formats, mods),
  random team generators, team validator, and `data/text/` (English + translated tables).
- Published on npm as `pokemon-showdown` (latest checked: **0.11.11, 2026-07-28**; ships
  `dist/data/mods/champions`).

### `smogon/pokemon-showdown-client` — web client → **AGPLv3** ⚠️

- Its README states it explicitly: _"This is NOT the same license as Pokémon Showdown's server."_
- If we copy its code (e.g. battle animations, battle scene CSS, layout), **all of Poke-Air would have to be
  AGPLv3** and offer its source to anyone using it over a network.
- They offer MIT relicensing to legitimate open-source projects on request (`staff@pokemonshowdown.com`).
- **Decision:** we do not copy client code. Visual inspiration only; our own animations.

### `@pkmn` ecosystem (github.com/pkmn/ps) → **MIT** ✅

Modular extraction of Showdown, with the client-side parts relicensed MIT.

| Package                  | Use in Poke-Air                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `@pkmn/protocol`         | Parse the battle log (Host)                                                                  |
| `@pkmn/client`           | **Not used**: needs a `@pkmn/dex` generation, which lacks the Champions mod (new Megas)      |
| `@pkmn/img`              | Resolve sprite/icon/trainer URLs, pointing to **our own** domain                             |
| `@pkmn/sets`             | Showdown text import/export (alternative to `Teams`)                                         |
| `@pkmn/sim`, `@pkmn/dex` | **Not used for now**: latest `0.10.11` (2026-06-18) does **not** include the `champions` mod |

> The upstream `pokemon-showdown` package is ~147 MB unpacked (all gens/mods). Fine on the server; not
> suitable for the browser as-is. Browser-side needs come from compact JSON generated at build time.

## PokeAPI: is it useful?

**For battle mechanics: no.** PokeAPI is a Pokédex database, not an engine. It does not model in-battle
interactions (what each ability/item does), damage formulas, priority, formats or competitive legality.

**What it still offers:**

- Localized **flavor text** (game descriptions) where Showdown's `data/text/<lang>` has `null` descriptions.
- The `PokeAPI/sprites` repo with official sprites and a `showdown` folder of animated GIFs (created by the
  Smogon community, which allowed PokeAPI to serve them).

**Fair-use policy:** local caching is mandatory; abuse leads to permanent IP bans.
→ Only queried **at build time** in `packages/data`, never from clients at runtime.

Note: Showdown's own README for `data/text` says its translated names/descriptions were **sourced from
PokeAPI**, so for names the two sources agree.

## Sprites and graphic assets

- **Do not hotlink `play.pokemonshowdown.com`.** The `@pkmn/img` README explicitly asks developers to host
  their own sprites to **avoid driving up Showdown's bandwidth costs**; its functions accept
  `protocol`/`domain` options to point at your own host.
- Plan: a script in `packages/data` downloads **only the needed subset** once (sprites for the ruleset's
  roster, icons, ~30–60 trainers, backgrounds) and publishes them to our static host / Cloudflare R2 (free
  tier, zero egress) with long cache headers. **Assets are never committed to git.**
- Styles: `gen5ani` + `gen5ani-back` (classic Showdown BW animated look) recommended for consistency and
  weight. Need to verify coverage of the newest Megas (Legends Z-A / Champions); fallback to `home`/static.
- **Mandatory in-app credits:** Smogon Sprite Project, Showdown trainer sprite artists, PokeAPI, Pokémon Showdown.
- Audio (cries/music): same rights as sprites. Optional and off by default; CC0 music is an alternative.

## Pokémon intellectual property

- Names, Pokémon and trainer designs, sprites, music and the "Pokémon" brand belong to **Nintendo /
  Game Freak / Creatures Inc. / The Pokémon Company (TPC)**. There is no public license for fan projects:
  they exist through **tolerance**, which can be withdrawn at any time.
- Historically TPC/Nintendo act against fan games that are **monetized, heavily promoted, or compete with
  official products** (several were taken down via DMCA). Showdown survives as free, non-commercial and
  community-driven.

### Risk-minimizing guidelines

1. **Zero monetization:** no ads, no donations tied to the game, no payments. (Also required by Vercel
   Hobby's non-commercial terms.)
2. **Visible disclaimer** of an unaffiliated fan project (README + Host footer).
3. **Low-profile instance:** `noindex`/`robots.txt`, no public promotion. No password (decided: AirConsole-style
   access by room code); rooms are ephemeral and leave no public content.
4. **Name/domain without "Pokémon":** "Poke-Air" is fine as a project name; avoid `pokemon-*` domains and
   official logos.
5. **Repo:** if public, never commit sprites or audio — only the script that fetches them.
6. If client code were ever needed: license Poke-Air as AGPLv3 (and publish the source) or request relicensing.
