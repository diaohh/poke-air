# 04 — Battle modes and simulator mapping

## Scope

| Format      | Compositions        | Status                                 |
| ----------- | ------------------- | -------------------------------------- |
| **Singles** | 1v1                 | **v1**                                 |
| **Doubles** | 1v1, 1v2 / 2v1, 2v2 | **v1**                                 |
| Triples     | 1v1 … 3v3           | Future extension (see end of this doc) |

Showdown **does** simulate triples (`gameType: 'triples'`, e.g. `[Gen 9] Triples`); what it lacks is a
_Champions_ triples format, which we would have to register ourselves. Triples are postponed to keep v1
small and stable, not because of a simulator limitation. The OwnershipLayer is designed generically
(N positions, N humans) so triples can be added later without redesign.

The core challenge: Showdown models **sides** (`p1`, `p2`) and each side receives a single `request`
covering all its active positions. Poke-Air wants **two humans to share a side** (2v2) and **asymmetric**
setups (1v2). We map humans ↔ what the sim understands.

## What the simulator already handles (no extra work)

- **One action per active Pokémon per turn** (move, switch, or Mega Evolve + move).
- **Spread moves** and their targets: Earthquake hits **all adjacent Pokémon, including the ally**;
  Rock Slide/Heat Wave hit both foes; spread damage is reduced (×0.75) when hitting multiple targets.
- **Immunities**: Earthquake doesn't affect Flying types, Levitate, Air Balloon, Magnet Rise, etc.
- Redirection (Follow Me, Rage Powder, Lightning Rod, Storm Drain), Ally Switch, Wide Guard, Helping Hand,
  speed order, priority, abilities, items, weather, terrain…

## Pokémon quota per player

**Principle: resources are balanced per team and split among its players.** Each team brings at most 6:

| Humans on the team | Pokémon per human |
| ------------------ | ----------------- |
| 1                  | 6                 |
| 2                  | 3                 |

E.g. doubles 1v2: the solo player builds 6, each opponent builds 3. A player may bring fewer than their quota,
but **a doubles side needs at least 2 Pokémon** (the simulator crashes with a one-Pokémon side, spike S2):
a solo doubles player needs 2 to be Ready, each player of a pair at least 1 (D-44, `TEAM_TOO_SMALL`).

## Chosen approach: one sim side per team + **OwnershipLayer**

- `singles` / `doubles` with **p1 = Red team** and **p2 = Blue team**.
- The side's team = concatenation of its humans' sub-teams (known order).
- Our own layer, **OwnershipLayer** (`packages/core`), knows **who owns each Pokémon** and splits/merges decisions.

```
Red humans:  Ana (Pokémon 1-3), Ben (Pokémon 4-6)       ──► p1 (team of 6) ─┐
Blue humans: Carla (Pokémon 1-6)                         ──► p2 (team of 6) ─┴─ doubles
```

### OwnershipLayer rules

✅ Implemented in Phase 3 (`packages/core/src/battle/ownership.ts`, decision D-43; details and spike S2
results in `14-phase-3-plan.md`).

1. **Ownership is per Pokémon, not per position.** Whoever controls an active position is the owner of
   the Pokémon currently in it (so Ally Switch or switches never break anything). **Controller = owner, always.**
   Pokémon are identified by the sim's name for them (`battleName()`: formes use their base species).
2. **Initial positions:** in 2v2 the left position gets Ana's first Pokémon, the right one Ben's first
   (the side team is ordered leads first, D-46). A solo player controls both positions.
3. **Request splitting:** when a `|request|` arrives for `p1`, a filtered request is built per human:
   only their active positions (`active[]` / `forceSwitch[]` entries carry `position` + `pokemon`) and only
   their own Pokémon (with `slot` = `switch N`). Allies' Pokémon are **not** sent: the ally only appears in
   the public `field` view (name, species, public HP %) used for targets. Mega options are filtered by the
   player's Mega quota (see below). A player with nothing to decide gets a `wait` request.
4. **Choice merging:** each human sends one action per position they control, comma-separated
   (`move 1 2 mega, switch 5`); the server builds the full side choice position by position, writing `pass`
   where nobody decides (fainted / commanding positions, holes nobody can fill — the sim needs them
   explicit). Validation: correct owner, switch slots they own and not picked twice, targets valid for the
   move, Mega quota and one Mega per team per turn; the sim validates the merged choice.
5. **Forced switch after a faint:** the owner of the fainted Pokémon picks among **their** benched Pokémon.
   If they have none left but the sim forces the slot to be filled (it does whenever any Pokémon on the side
   is available), the position passes to the **ally**, who sends in one of their own Pokémon (and therefore
   controls it — rule 1 holds). A human with no Pokémon left becomes a spectator on their phone.
6. **Timer:** if a human doesn't choose in time (60 s singles / 90 s doubles, D-49), their part is completed
   with explicit automatic actions (first usable move aimed at a standing foe, or their first Pokémon that
   can come in; never Mega Evolving) and the teammates' parts are kept. `default` can't be used per
   position: inside a comma list it completes every remaining position.
7. **Undo:** each human can undo their part while the turn hasn't resolved; if the merged choice was
   already sent, the side's choice is undone in the sim and the teammates' parts are kept.

### Why not Showdown's `multi` game type for 2v2?

`multi` is native (4 players, each their own side and own Mega), but it doesn't cover 1v2 (a solo player
would be forced to split their team into two fixed halves, one per position), and it would mean two
different mechanisms. One side per team + OwnershipLayer covers every composition with a single mechanism.
`multi` remains a fallback for 2v2 if spike S2 fails.

## Mega Evolution: one per player

### Rule

- **Each player has their own Mega Evolution** (like each trainer's Mega Ring in official multi battles),
  instead of the sim's default of one per side.
- **Asymmetric games keep team parity:** each team's Mega budget = number of players on the larger team,
  split evenly among its players (same principle as the Pokémon quota).
- **At most one Mega Evolution per team per turn** (simulator constraint, see implementation).

| Composition              | Red                                            | Blue  |
| ------------------------ | ---------------------------------------------- | ----- |
| 1v1 (singles or doubles) | 1                                              | 1     |
| 1v2                      | solo player: **2** (must be different Pokémon) | 1 + 1 |
| 2v2                      | 1 + 1                                          | 1 + 1 |

### Implementation (verified against the sim source; ✅ built in Phase 3)

Two limits exist in Showdown:

- `BattleActions.runMegaEvo()` — after a Mega, sets `canMegaEvo = false` for **every Pokémon on the side**.
  This method is overridable.
- `Side.chooseMove()` — rejects a second `mega` in the **same side choice** ("You can only mega-evolve once
  per battle"). Hardcoded (only bypassed for the Mix and Mega mod); not exposed to mod overrides.

Plan:

1. `BattleAdapter` overrides `runMegaEvo` **on the battle instance** so it only changes that Pokémon's
   forme and does not disable the rest of the side. The simulator becomes permissive.
2. **The OwnershipLayer enforces the policy:** it tracks each player's remaining Megas by reading
   `|-mega|` events from the log (mapping the Pokémon to its owner), hides the Mega option in requests
   when the quota is spent, and rejects choices that exceed it.
3. The "one per team per turn" limit stays (no monkey-patching of `Side.chooseMove`). A later improvement
   could lift it by patching the instance's `chooseMove`, if the restriction feels bad in playtests.

### Edge cases

| Case                                                    | Handling                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Both teammates toggle Mega on the same turn** (2v2)   | Lock: once one player's **sent** part Mega Evolves, the ally's menu is re-sent with `allyMega` and their toggle is disabled with _"Your ally is Mega Evolving this turn"_; released if they undo. If two choices still race, the first confirmed one keeps the Mega and the second is **rejected** with `MEGA_TAKEN` (the player re-taps without Mega; D-45). No quota is lost. |
| Solo player in 1v2 wants to Mega both actives on turn 1 | Not allowed (one per team per turn); they can Mega the second one on a later turn. The UI disables the second toggle.                                                                                                                                                                                                                                                           |
| Player toggles Mega, then undoes / changes action       | Quota is consumed only when the `\|-mega\|` event happens, never on selection.                                                                                                                                                                                                                                                                                                  |
| Pokémon holding a Mega Stone passes to the ally         | Can't happen: ownership is per Pokémon and the controller is always the owner, so quota is charged to the right player.                                                                                                                                                                                                                                                         |
| Turn timer expires                                      | The auto-completed choice never includes Mega.                                                                                                                                                                                                                                                                                                                                  |
| Several Mega Stones on one player's team                | Allowed (no Item Clause); the quota decides how many actually Mega Evolve.                                                                                                                                                                                                                                                                                                      |
| Primal Reversion (Red/Blue Orb)                         | Automatic on switch-in; not a Mega, doesn't consume quota.                                                                                                                                                                                                                                                                                                                      |
| Mega Rayquaza (no stone, needs Dragon Ascent)           | Counts as a Mega (legendaries allowed).                                                                                                                                                                                                                                                                                                                                         |
| Mega already used and the Pokémon switches out/back in  | Stays Mega (sim behavior); no additional quota consumed.                                                                                                                                                                                                                                                                                                                        |
| Public information                                      | Host side card shows one Mega mark per Mega of the side's budget, greyed as the side Mega Evolves (D-48).                                                                                                                                                                                                                                                                       |

## Future extension: triples

Requirements when revisited:

- Register a custom `[Poke-Air] Champions Triples` format (mod `champions`, `gameType: 'triples'`).
- Quotas: 3 humans → 2 Pokémon each; 2 humans → 3 + 3, one controlling 2 positions.
- Mega budget per the same parity rule; still one Mega per team per turn.
- Triples adjacency and the Shift command are already handled by the sim.
