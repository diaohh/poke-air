# 01 — Vision and game flow

## Vision

Pokémon Showdown is great for playing online, but not for playing **together in person**: everyone on their
own screen, with accounts and challenges. Poke-Air takes Showdown's engine and brings it to the
**AirConsole** model:

- **One shared screen** (PC connected to a TV/monitor) = the stadium.
- **Phones** = personal, private controllers.
- **Zero friction:** no accounts, nothing to install. Scan QR → name → play in under a minute.

## Actors

| Actor          | Device  | Route      | Responsibility                                                                     |
| -------------- | ------- | ---------- | ---------------------------------------------------------------------------------- |
| **Host**       | PC / TV | `/host`    | Creates the room, shows QR, lobby, format/ruleset selection, battle scene, results |
| **Controller** | Phone   | `/j/:code` | Name + avatar, switch team, build their share of the team, choose battle actions   |
| **Server**     | Cloud   | —          | Rooms, validation, simulator, private information routing                          |

The Host **is not a player** in the MVP (see decisions).

## Room state machine

```
          host:createRoom
               │
               ▼
  ┌──────────► LOBBY ──── host:startTeamBuilding (valid composition) ────► TEAM_BUILDING
  │              ▲                                                              │
  │              │ host:backToLobby                                   all player:ready
  │              │                                                              ▼
  │           RESULTS ◄──────────────── battle:end ────────────────────────── BATTLE
  │              │
  └──────────────┘ host:rematch (keeps teams → TEAM_BUILDING or straight to BATTLE)
```

Cross-cutting rules:

- A disconnected player **keeps their seat** (flagged "disconnected") and can come back.
- The room expires after N minutes without a connected Host (e.g. 30 min).
- The Host can kick players in LOBBY.
- The room has a **locale** (see `06-i18n.md`) chosen by the Host.

## Screens

### Host — Lobby

- Large room code (4 letters, no ambiguous characters like `O/0`, `I/1`) + **QR** to `https://<domain>/j/ABCD`.
- **Format selector:** Singles · Doubles.
- **Language selector** for the room.
- No ruleset selector in v1: a single "Casual" ruleset; any extra restriction is a verbal agreement between
  players (see `05-game-rules-and-mechanics.md`).
- No password: anyone with the room code can join (AirConsole-style).
- Two columns: **Red team** vs **Blue team** with player cards (avatar + name + connection status).
- Composition indicator: "2v2 Doubles ✓" or "Singles allows only 1 player per team ✗".
- **Start** button enabled only when the composition is valid.

### Controller — Join / Lobby

- Form: name (prefilled from last time), trainer avatar (random by default, carousel to change).
- Simple view of both teams + **"Move me to Red/Blue"** button.

**Lobby model:** the Host picks only the **format**; the **composition is derived from how players split**.
A joining player is auto-placed on the team with fewer players and can switch from their phone. This makes
1v2, 2v2, 3v1, etc. work without configuring each combination.

| Format             | Players per team | Valid examples |
| ------------------ | ---------------- | -------------- |
| Singles            | exactly 1        | 1v1            |
| Doubles            | 1–2              | 1v1, 1v2, 2v2  |
| _Triples (future)_ | _1–3_            | _1v1 … 3v3_    |

### Controller — Team building

- Grid of **slots** sized by the player's quota: 6 or 3 Pokémon (see `04-battle-modes.md`).
- **🎲 Randomizer**: fills empty slots (or rerolls everything) with viable sets.
- Each card: **Edit** / **Remove** / 🎲 (single reroll, optional).
- **Editor:** species, item, ability, 4 moves, nature, **Stat Points** (66 total, max 32 per stat).
  No IV editor (IVs are fixed; see `05-game-rules-and-mechanics.md`). Buttons **Save** and **Delete**.
- High-value extras: **import/export Showdown text** (paste a team), **saved teams** on the phone (localStorage).
- **Ready** button (can be unset). Incomplete teams are allowed (≥ 1 Pokémon).
- Server-side validation with Showdown's `TeamValidator` for the active ruleset before accepting "Ready".

### Host — Team building

- Player cards with progress ("3/3 Pokémon · ✓ Ready"). Does **not** reveal Pokémon (revealed in battle).
- Optional later: VGC-style _team preview_.

### Host — Battle

Inspired by Showdown but with its own identity:

- Stage background; **trainers** on each side (avatar sprites).
- Active Pokémon with animated sprites (back sprites on the left side, front sprites on the right).
- HP bars with %, status (PAR/BRN/…), stat stage changes, weather/terrain/screens.
- Mega Ring icon per trainer (available / used).
- Text box narrating the turn ("Garchomp used Earthquake!", "It's super effective!").
- Poké Ball row per player showing remaining/fainted Pokémon.
- Per-player "choosing… / ready" indicator and turn timer.
- **Simple animations:** lunge for physical moves, type-colored projectile for special moves, glow for
  status moves, flash on damage, fade-out on faint, Poké Ball on switch, special effect on Mega Evolution.

### Controller — Battle

- Their active Pokémon with exact HP and status.
- **Fight:** 4 move buttons (type, PP, optional effectiveness hint) + **Mega Evolve** toggle when the
  player still has Mega quota (disabled with a hint if the ally is Mega Evolving this turn).
- Doubles: **target selection** after choosing a move.
- **Switch:** list of THEIR benched Pokémon (HP/status).
- Forced switch after a faint.
- "Waiting for others…" after choosing; **undo** while the turn is unresolved.
- **Forfeit** option.

### Results

- Host: winner, simple MVP (most KOs), **Rematch** / **Back to lobby** buttons.
- Controller: same summary, "Play again" button.

## Non-functional requirements

- Joining takes < 30 s from scanning the QR.
- Network latency is irrelevant (turn-based), but the UI must react < 200 ms to each tap.
- Transparent reconnection in every phase.
- Keep the phone screen on during a match (**Screen Wake Lock API**).
- Host optimized for 16:9 fullscreen, readable from 3 m away.
