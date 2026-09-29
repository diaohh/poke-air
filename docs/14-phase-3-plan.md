# 14 — Phase 3 plan: doubles (+ item icons)

Self-contained plan (and record of what was built) for Phase 3, which completes the v1 scope (D-12):
**doubles 1v1 / 1v2 / 2v2** with the OwnershipLayer, target selection and Mega Evolution per player.
It also adds **item icons** to the team builder and the phone's battle sheets. Read `CLAUDE.md`,
`docs/04-battle-modes.md` and the "Verified simulator facts" in `docs/05-game-rules-and-mechanics.md`
first. Where the code and this file disagree, the code wins — update this file.

## Status (2026-09-28): implemented, pending manual validation

As with Phase 2, **no new unit tests yet**: they come after the manual validation (§ Tests to add).
The existing suite and `pnpm check` must stay green.

Verified while building it: `pnpm check` green (76 tests; two existing assertions adapted to the new
shapes: `forceSwitch` entries and the Host model's positional `active`), the existing `pnpm test:e2e`
(singles) passes, and throwaway Playwright runs (not committed) played a **2v2** (four phones) and a
**1v2** doubles battle to the end without page errors: target picker, ally line, `1 / 2` steps for the
solo player, forced switches, one Mega per player with the side's Mega marks greyed, Host slots and
side cards for both formats, item icons on the team cards.

Found and fixed while building it:

- **The sim renames a Pokémon named after its species to its base species** (`Rotom-Wash` → idents
  `p1: Rotom`, spike follow-up). Ownership and the owner-only request data (nature, Stat Points, D-34)
  were keyed by our set name, so formes lost them. `battleName(set)` (core `battle/request.ts`)
  mirrors the sim's rule and keys both.
- A teammate's choice re-sends the player's menu (Mega lock); if it crossed the player's own
  `battle:choose` in flight, it carried `choice: null` and wiped the optimistic waiting view. The
  phone store keeps the choice that is still waiting for its ack.
- Two trainers per side overlapped the near slots: doubles layouts use smaller trainers and narrower
  side cards.

## Starting point

- Phase 2 (team builder) and the battle-information iteration are implemented, pending validation.
- Doubles can already be **selected** in the lobby (`host:setFormat`), compositions 1v1 / 1v2 / 2v2 are
  validated, quotas split 6 → 3 + 3, and battles start on `gen9championsdoublescustomgame`. But the
  battle layer is singles-only: `OwnershipLayer` is the identity mapping, a phone only drives
  `active[0]`, choices carry no target, the Host scene shows one Pokémon per side, and the sim's
  "one Mega per side" rule applies.

## Item icons — feasibility (done before planning)

| Question             | Result                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is the data there?   | Yes: every item in the Showdown dex has `spritenum`, its index in Showdown's item icon sheet (MIT data, no hardcoding). **363 / 363** legal items have one.       |
| Is the image there?  | One file, `sprites/itemicons-sheet.png`: 384 × 1152 px, 24 × 24 icons, 16 per row, **89 KB**. All 363 legal items (new Champions Mega Stones included) are drawn. |
| Matches `@pkmn/img`? | Yes: `Icons.getItem()` computes the same offsets (`spritenum % 16 × 24`, `⌊spritenum / 16⌋ × 24`).                                                                |
| Licensing            | Same category as the Pokémon sprites: © Nintendo / TPC, self-hosted, downloaded once by `pnpm fetch:sprites`, never committed or hotlinked (docs/03).             |
| Cost on the phone    | One cached 89 KB image, CSS `background-position`; +1 small number per item in `teambuilder.json`.                                                                |

→ **Viable and cheap** (decision D-42). Shown in: item picker rows, the editor's Item field, the team
list cards, the phone's battle Pokémon sheet. Without the sheet (not downloaded yet) the icon is simply
empty.

## Spike S2 results (2026-09-28, pokemon-showdown 0.11.11)

Scripted doubles battles through `BattleSession` (throwaway scripts):

| Fact                                                                                                                                                                                                                                           | Consequence                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Doubles request: `active[i]` per position (moves with `target`), `side.pokemon` with the actives first **in position order**; switching **reorders** `side.pokemon` (the incoming Pokémon takes the outgoing one's index)                      | Ownership is per Pokémon (by name), never per index; position `i` = `side.pokemon[i]`; `switch N` = current index + 1                   |
| **A side with one Pokémon crashes a doubles battle** (`Cannot read properties of null (reading 'forceSwitchFlag')`)                                                                                                                            | Doubles needs **≥ 2 Pokémon per side**: a solo doubles player needs 2 to be Ready (`TEAM_TOO_SMALL`, D-44)                              |
| Two `mega` in one side choice → rejected ("only mega-evolve once per battle"); default `runMegaEvo` then disables `canMegaEvo` for the whole side                                                                                              | Instance override of `runMegaEvo` (only the evolving Pokémon loses `canMegaEvo`) → a second Mega on a later turn is accepted (verified) |
| Single-target moves need a target in doubles: `move 1` → rejected; `move 1 2` (foe b), `move 1 -2` (own b) accepted                                                                                                                            | Target step on the phone; timer defaults compute a target                                                                               |
| `default` inside a comma list auto-completes **every** remaining position                                                                                                                                                                      | A player who timed out gets explicit per-position defaults, not `default`                                                               |
| Forced switch `[true, true]` with one Pokémon left: `switch 3` → rejected, `pass, switch 3` accepted; `[false, true]` → `pass, switch 3`; a fainted active without replacement in a move request accepts `pass` (or is auto-passed at the end) | The merge writes **every** position explicitly: the controller's action, or `pass`                                                      |
| `\|-mega\|p1b: Lucario\|Lucario\|Lucarionite` names the position                                                                                                                                                                               | Mega quota tracked from the log, charged to the Pokémon's owner                                                                         |
| Side requests expose `side.pokemon[].commanding` (Tatsugiri inside Dondozo); the sim auto-passes it                                                                                                                                            | Commanding / fainted positions get no controller (`pass`)                                                                               |

## General analysis

| Area            | Today                                         | Phase 3                                                                                                                                                                               |
| --------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team readiness  | ≥ 1 Pokémon per player                        | Doubles: ≥ 2 per side → solo player ≥ 2, each of a pair ≥ 1 (`TeamState.minimum`, `TEAM_TOO_SMALL`)                                                                                   |
| Leads           | Side team = players' sets concatenated        | Each player's first Pokémon first: 2v2 → left = first player's lead, right = second player's lead (D-46)                                                                              |
| OwnershipLayer  | Identity (one human per side)                 | Positions → controller per decision, per-player requests (own Pokémon only + public field), choice validation, per-position merge, timer defaults, Mega quota per player (D-43, D-45) |
| Sim patch       | `reportExactHP`, `debugMode`                  | + `runMegaEvo` instance override (per-Pokémon), public field view for targets                                                                                                         |
| Protocol        | `choice` = one action; request = side request | `choice` = the player's actions for their positions, comma-separated, with targets; request carries only the player's slots / Pokémon / field / Mega budget                           |
| Phone battle UI | One Pokémon, move → send                      | One step per controlled position (move → target, or switch), then send; target picker; ally line; Mega lock                                                                           |
| Host scene      | One slot per side                             | Two slots per side (mirrored far side), per-slot animations and orbs, two Pokémon rows per side card, side Mega marks = side budget                                                   |
| Turn timer      | 60 s                                          | 90 s in doubles (docs/05 default)                                                                                                                                                     |
| Item icons      | —                                             | `DexItem.icon`, `BattlePokemon.itemIcon`, `ItemIcon` component, sheet downloaded by `fetch:sprites`                                                                                   |

Unchanged rules: server authoritative (the sim validates every merged choice), privacy (a phone never
receives a teammate's Pokémon or sets: the ally only appears through the public field view, the same
data the TV shows), no hardcoded data, every string an i18n key.

## Decisions (recorded in `08-decisions.md`)

- **D-42** Item icons from Showdown's item icon sheet, positioned by the dex `spritenum`; self-hosted
  (`pnpm fetch:sprites`), never committed.
- **D-43** OwnershipLayer protocol: each phone gets a request with only **its** positions (`active` /
  `forceSwitch` entries carry `position` + `pokemon`), **its** Pokémon (with `slot` = `switch N`) and a
  public `field` view (active Pokémon of both sides with public HP %) for targeting. The phone answers
  with its actions in position order, comma-separated (`move 1 2 mega, switch 4`). The server validates
  ownership, merges per position (uncontrolled positions → `pass`) and the sim validates the rest.
  Forced-switch holes go to the owner of the fainted Pokémon, or to the teammate if the owner has no
  Pokémon left (rule 5 of docs/04), else `pass`.
- **D-44** Doubles need ≥ 2 Pokémon per side (sim crash with 1): `Room` requires
  `ceil(2 / players on the team)` Pokémon to be Ready (`TEAM_TOO_SMALL { min }`).
- **D-45** Mega per player: `runMegaEvo` instance override in every battle; quotas (1, or 2 for the
  solo player of a 1v2) are enforced by the OwnershipLayer from `|-mega|` lines. One Mega per team per
  turn stays (sim limit): the ally's toggle is locked while a teammate's chosen part Mega Evolves
  (`allyMega`), and a racing second Mega is **rejected** with `MEGA_TAKEN` (instead of the silent strip +
  notice sketched in docs/04 — simpler, and nothing is lost: the player just re-taps).
- **D-46** Leads: each player's first Pokémon leads (2v2: first-joined player on the left).
- **D-47** Forfeit forfeits the whole team (the sim has one side per team); the phone says so in 2v2.
- **D-48** Host doubles layout: the far side is mirrored (p2a on the right, facing p1a); phones list
  targets in TV order. The side card's Mega marks = the side's Mega budget, greyed as the side Mega
  Evolves (no per-player attribution on the TV).
- **D-49** Turn timer: 60 s singles, 90 s doubles.

## Specific plan

### P1. Item icons

- `shared/dex.ts`: `DexItem.icon` (sprite index). `core/team/dex-data.ts`: fill it from `spritenum`;
  `TEAM_BUILDER_DATA_VERSION` 4 → 5 (the builder data rebuilds itself).
- `shared/battle.ts`: `BattlePokemon.itemIcon?`; `core/battle/request.ts` fills it from the dex.
- `packages/data/scripts/fetch-sprites.ts`: download `sprites/itemicons-sheet.png` (+ `ITEM_ICONS_URL`
  in shared).
- Web: `components/ItemIcon.tsx` + `styles/components/_item-icon.scss` (sheet as background, scaled
  with `--scale`, pixelated). Used by the item picker, the editor's Item field, the team cards and the
  battle Pokémon sheet.

### P2. Rules (`packages/core` rooms)

- `Room.minimumFor(playerId)` = `ceil(activePerSide / players on the team)`; `setReady` / `allReady`
  enforce it; `TeamState.minimum`.
- `Room.battleSides()` keeps players' sets; `MatchController` orders the side team: every player's first
  Pokémon, then the rest in player order.

### P3. OwnershipLayer + battle (`packages/core/battle`)

- `request.ts`: `enrichRequest` returns an internal `SideRequest` (all positions, all Pokémon with
  `slot` / `position`, `commanding`); `activePerSide` from the format.
- `ownership.ts` (rewrite): built from `{ playerId, pokemon: names, megas }` per side.
  `controllers(side, request)` (per position), `requestFor(playerId, request, parts, field)`,
  `validatePart(...)` → normalized actions or `RoomError` (`INVALID_CHOICE`, `MEGA_TAKEN`),
  `merge(...)`, `defaultPart(...)` (first usable move + target / first free own Pokémon), Mega quota
  (`recordMega(side, name)`, `megasLeft(playerId)`).
- `battle-session.ts`: `runMegaEvo` override; `publicField()` (name / species / public HP % of every
  active position, Illusion-safe).
- `match-controller.ts`: participants per decision; parts as action lists; teammates' requests
  re-emitted on part changes (Mega lock); per-player defaults on timeout (whole-side `default` fallback
  if the merge is rejected); Mega tracking from the spectator lines; turn timer by format.

### P4. Protocol (`packages/shared`, `apps/server`)

- `battleChoiceSchema`: 1–2 actions `move [1-4]( -?[12])?( mega)?` · `switch [1-6]`, or `default`.
- `BattleRequest`: `activePerSide`, `active[]` / `forceSwitch[]` entries with `position` + `pokemon`,
  `pokemon[]` (own, with `slot`), `field { own, foe }`, `megasLeft`, `allyMega`.
- Errors: `TEAM_TOO_SMALL { min }`, `MEGA_TAKEN`. Server handlers unchanged (validation + core).

### P5. Phone (`apps/web/src/controller`)

- Team builder: Ready disabled below `team.minimum`, hint "Doubles: bring at least 2 Pokémon".
- Battle `Decision`: one step per slot (`stepIndex`, accumulated actions, Back to the previous
  position). Move slot: menu (active card + ally line) → FIGHT → move (tap / tap again) → **target**
  (when the move needs one and there are 2 positions; auto-picked if only one target is valid) → next.
  Pokémon → party (Pokémon already picked this turn disabled) → next. Switch slots: "Replace X" party
  list. Last step sends the joined choice.
- Mega toggle hidden without quota, disabled (with hint) when the ally Mega Evolves this turn or an
  earlier position of this player already does.
- Waiting view: one summary line per action (with target). Wait screens: "Waiting for the other
  trainers…", "Your Pokémon are out — cheer on your ally!".
- Forfeit sheet: "Your team will lose" wording when the player has a teammate.

### P6. Host (`apps/web/src/host/battle-scene`)

- Model: `SceneSide.active: (string | null)[]` by position (from `p1a` / `p1b`), `|swap|` (Ally Switch),
  events carry `position` / `targetPosition`, `activePokemon(state, side, position)`, `activePerSide`
  from `|gametype|`.
- Layout: doubles variants of `LAYOUTS` (two slots per side, smaller sprites / platforms, orb points per
  slot), `animationsFor` keyed by slot, side card with one compact row per active Pokémon, per-player
  "Choosing" pills in 2v2, Mega marks = side budget.

### P7. Docs

`02` (protocol), `04` (implementation notes), `05` (S2 facts, timer), `08` (D-42…D-49), `09`
(status), `10` (fetch:sprites, pitfalls), `12` (doubles screens, item icons), `03` (item icon sheet),
`CLAUDE.md`, this file.

## Out of scope (Phase 3)

- Revival Blessing (choose a fainted Pokémon): the phone can't pick fainted Pokémon; the turn timer
  lets the sim choose. Rare in the Casual roster; revisit if it shows up in playtests.
- Two Megas on the same turn for one team (O-01), triples, team preview.
- Mirroring field effects on the phones.

## Tests to add (after manual validation)

- core: `Room` minimum (solo doubles 2, pair 1, singles 1), lead order; OwnershipLayer with scripted
  doubles battles (fixed seed): 1v1 doubles (one player, two positions), 1v2 (solo 2 Megas on different
  turns, opponent pair), 2v2 (split requests, merge, targets, forced switch to the owner, hand-over to
  the ally when the owner has no Pokémon, `pass` holes), Mega quota and `MEGA_TAKEN`, timer defaults
  with one player missing, undo of one part, Ally Switch ownership; `battleName` (formes named after
  the base species) and the nature / Stat Points of a forme in its owner's request.
- server: `battle:choose` with two actions and targets; `TEAM_TOO_SMALL`.
- web: model reducer over a doubles log (`p1b`, `|swap|`, spread moves), `summarize` with targets,
  target options per move target type (shared `targetOptions`), `tvOrder`, `ItemIcon` offsets, the
  store keeping a pending choice over a stale re-sent menu.
- E2E: a 2v2 doubles battle with four phone contexts (the throwaway run's `playTurn` handled Mega,
  targets and forced switches: a good starting point).

## Manual validation checklist

1. `pnpm build:data` rebuilds the builder data (version 5; `pnpm dev` does it); `pnpm fetch:sprites`
   downloads `sprites/itemicons-sheet.png` (already placed locally during development: the script
   skips it).
2. Item icons: item picker rows, editor Item field, team cards, battle Pokémon sheet.
3. Doubles 1v1: a player with 1 Pokémon can't get Ready ("at least 2"); with 2+ the battle starts with
   two Pokémon per side; each turn the phone asks for both positions, then sends; single-target moves
   ask for a target (foe or ally ⚠); spread / self moves don't.
4. Doubles 2v2: each phone controls only its own Pokémon (left = first-joined player); the ally's
   Pokémon only shows in the target list; both choose in parallel; a KO asks the owner for a
   replacement; when a player runs out, the ally fills the hole; a player with nothing left sees the
   "cheer on your ally" screen.
5. Mega: 2v2 → each player Mega Evolves once; toggling Mega locks the ally's toggle for that turn;
   1v2 → the solo player Mega Evolves twice (different turns); the Host's side card greys one Mega mark
   per Mega.
6. Timer (90 s in doubles): a player who doesn't choose gets an automatic move; the teammate's choice
   is kept.
7. Host: two slots per side, attacks fly to the right target slot, side cards list both actives, Ally
   Switch swaps the slots.
8. Singles still works as before (regression: `pnpm test:e2e`).

## Feedback round 1 (2026-09-28) — implemented, pending manual validation

Requested after the Phase 3 build, before Phase 4 (Spanish). Scope agreed with the team: these
adjustments now; for Phase 4 only spike S4 and its plan (`docs/15-phase-4-plan.md`). No new unit tests,
no commits until manual validation.

Verified while building it: `pnpm check` green (76 tests) and throwaway Playwright runs (not committed)
on a touch phone context and the Host: phone Home without Host, `/teams` (3 random slots, editor 🎲
keeping the species, save, import of 7 → keep 6, save), room 2v2 loading a 6-Pokémon saved team → keep
3, the VS burst between the panels, and a scripted doubles battle showing rain, Trick Room, Misty
Terrain, Reflect / Light Screen walls, Tailwind, Stealth Rock, Spikes and Toxic Spikes on the right
sides. `randomSetFor` was probed on Champions species (Garchomp, Charizard → Mega Stone), formes
(Rotom-Wash, Arceus-Fire keeps its Plate) and fallback species (Furret, Smeargle, Shedinja).

Also fixed on the way: with several field effects the top chips wrapped their text ("Rain · 2–" / "5");
chips now never break inside and the row wraps whole chips.

### Analysis

| Request                                                 | Today                                                                                                          | Viability / approach                                                                                                                                                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home on phones: Join only, no Host                      | Home shows Host + Join on every device                                                                         | Simple: phones (coarse pointer, same `isTouchDevice()` the fullscreen logic uses) get Join + Team builder; `/host` stays reachable by URL                                                                                        |
| Editor 🎲 randomizes the set, not the Pokémon           | 🎲 = `team:randomize` for the slot (new species) and leaves the editor                                         | Server generates a set **for the chosen species**: Champions random set when it (or its Mega) has one (311 of ~1250 formes), else a generated one from its legal movepool. Returned as a draft; Save validates                   |
| Field effect visuals (Showdown-like)                    | Only chips / tags with turns left                                                                              | **Viable, implemented:** own CSS layers (no Showdown client code or images): weather overlays, terrain ground tint, Trick Room, screens / Tailwind in front of each side, hazards drawn on each side's ground                    |
| VS burst hidden behind the blue team list               | 150 px burst in a 120 px column, painted under the next panel                                                  | Simple: smaller burst (112 px) above the panels                                                                                                                                                                                  |
| Team builder from Home, before any room                 | The editor only exists inside TEAM_BUILDING (server-validated through the room); saved teams only via the room | New phone page `/teams`: saved teams list, create / edit up to 6 Pokémon, random slot, import / export, save (Showdown text in localStorage, D-39). Needs server validation without a room → stateless `builder:*` socket events |
| Importing more Pokémon than the quota (e.g. 6 in a 2v2) | Handled silently: the server keeps the first `quota` Pokémon and reports how many were left out                | Better UX: when the pasted / saved team is bigger than the quota the phone asks **which** Pokémon to keep (split by the text's blank-line blocks, no server round trip), then imports only those                                 |

### Decisions

- **D-50** Phones get a phone Home: Join + Team builder, no Host button (the Host UI is for a PC / TV).
- **D-51** Stateless team builder events on `/player` (no seat needed, rate-limited per IP):
  `builder:validateSet { set }` → `{ set }`, `builder:randomSet { species?, exclude? }` → `{ set }`,
  `builder:parseTeam { text }` → `{ sets }`. Used by `/teams` and by the room editor's 🎲.
- **D-52** The editor's 🎲 randomizes moves, ability, nature, Stat Points (and the item when the random
  set has one) for the current species; picking another Pokémon stays with the list's 🎲 / Randomize.
  Generated fallback for species without Champions random sets: 2 STAB attacks + coverage in the better
  attacking category, one self-targeting status move, nature and SP on that stat and Speed (or HP when
  slow); the species' Mega Stone / required item when it has one.
- **D-53** Standalone team builder `/teams` on the phone; teams are saved as named Showdown texts (same
  store as the in-room "Save this team", D-39), so any saved team loads in a room.
- **D-54** Loading or importing a team bigger than the slots available asks which Pokémon to keep
  (preselects the first ones); the server still trims to the quota as a safety net.
- **D-55** Field effect visuals on the Host are our own CSS (weather, terrain, Trick Room, screens,
  Tailwind, hazards with layers); nothing from `pokemon-showdown-client`. Reduced motion stops the
  animations.

### Specific plan

1. **shared:** `builder:*` schemas + events + ack types; `splitTeamText()` / `teamTextSpecies()` in
   `team-text.ts` (pure).
2. **core:** `TeamService.randomSetFor(species)` (Champions random set → fallback generator → validated).
3. **server:** register `builder:*` handlers (no seat) with a per-IP token bucket (`builderBurst`,
   `builderPerSecond` in `RealtimeLimits`).
4. **web / editor:** `PokemonEditor` takes callbacks (`onSave`, `onRemove`, `onRandomSet`, `busy`,
   `error`) instead of reading the room store; the room passes socket actions, `/teams` its own.
   `PokemonCard` moves to its own file.
5. **web / room:** controller store `randomSet(species)`; `TeamMenu` import / load → keep picker when the
   text has more Pokémon than the quota (`KeepPicker`).
6. **web / `/teams`:** `teams/TeamsScreen` (list, new, import, edit, delete), `teams/TeamDraft` (name,
   up to 6 slots, random slot, export, save, discard), `teams/teams-store` (own player socket, builder
   events, busy / error).
7. **web / Home:** phone layout (Join + Team builder).
8. **web / Host:** `battle-scene/FieldEffects.tsx` + styles; VS burst size.
9. **Docs:** 02 (events), 08 (D-50…D-55), 09, 10, 12, CLAUDE.md, this section's status.

### Tests to add (feedback round 1, after manual validation)

- shared: `splitTeamText` / `teamTextSpecies` (nicknames, gender, `===` headers, CRLF).
- core: `TeamService.randomSetFor` (Champions species, Mega → base + stone, fallback species, required
  items, unknown species → `INVALID_SET`).
- server: `builder:validateSet` / `builder:randomSet` / `builder:parseTeam` without a seat, rate limit.
- web: `KeepPicker` (max, preselection, order kept), `saveTeam` replacing by id, phone Home.

### Feedback round 2 (2026-09-28) — implemented, pending manual validation

- **Effect chips as "left/total" (D-56):** "Rain · 1/4" = 1 turn left of 4. The total is the dex base
  duration; if the effect outlives it (an unseen Light Clay / weather rock), the total switches to the
  extended duration ("Reflect · 2/8"). Replaces the "3–6" ranges.
- **Ways back home (D-57):** Host header exit icon → "Close this room?" → `host:closeRoom` (phones are told
  the room was closed, the room is deleted, the Host goes Home and can open a new room). Phones: "Back to
  the home page" under the join form (after Leave room) and on the removed / room closed screen.
- Verified with a throwaway Playwright run: leave → home link; close room → Host Home, the other phone
  shows "The room was closed." and goes Home; a new room gets a new code; chips "Rain · 4/5",
  "Reflect · 4/5".

### Manual validation checklist (feedback round 1)

1. Phone Home: only the room code join + "Team builder"; the PC Home is unchanged.
2. `/teams`: create a team (add by search, 🎲 random slot, edit, remove), save it, reopen and edit it,
   export text, import a text with 7+ Pokémon (asks which 6), delete a team.
3. In a room (2v2, quota 3): Team menu → load that saved team → asks which 3 to keep → imports them.
   Pasting a 6-Pokémon text does the same.
4. Editor 🎲 on an existing Pokémon: same species, new moves / ability / nature / SP (also for a
   species without Champions random sets, e.g. Furret); Save keeps it.
5. Host lobby: the VS burst sits between the panels, not under the blue list.
6. Host (round 2): effect chips read "Rain · 3/5"; the exit icon closes the room (phones see "The room
   was closed." with a way home); after Leave room the phone offers "Back to the home page".
7. Host battle: Rain / Sun / Sand / Snow overlays; Electric / Grassy / Misty / Psychic terrain tint;
   Trick Room; Reflect / Light Screen / Aurora Veil / Tailwind in front of the right side; Stealth Rock,
   Spikes ×1–3, Toxic Spikes ×1–2, Sticky Web on the right side's ground; all disappear when they end.
