# 12 — Design system ("Stadium Wine")

Visual source of truth for `apps/web`. The interactive reference is
[`docs/design/ui-mockup.html`](design/ui-mockup.html) (open it in a browser; keys `1`–`5` switch screens).
**This file wins over the mockup** when they disagree. The mockup is ~70 KB: read this file first and open
the mockup only for a specific screen.

Status: approved (2026-09-27) and **implemented for every Phase 0 + Phase 1 screen** plus the Phase 2 team
editor (2026-09-28, pending validation) (Home, Host lobby,
team building, battle scene and results; phone Join, Teams, team builder, battle and results). Code layout
(tokens in `index.css`, SCSS partials in `styles/`, primitives in `components/ui/`): see
`10-development.md` § Styles.

Known gaps vs. the mockup:

- **Host "close room" button** is not shown: the protocol has no `host:closeRoom` event yet (the
  `player:removed` reason `roomClosed` already exists for it).
- **No "Battle!" button** on the Host team-building screen: O-11 was closed in favor of the automatic 3 s
  countdown (D-25), shown in place of the center ball.
- **Team builder** (Phase 2): ✏️ edit and ✕ remove per card as in the mockup; each dashed empty slot also
  has a 🎲 tile (random Pokémon) next to "+ Add Pokémon", and a ☰ "Team options" button sits in the header.
  The editor and pickers are not in the mockup; they follow the rules below.
- **Host battle scene** is not in the mockup; it follows these rules (see below).

## Principles

1. **Warm, tinted surfaces.** Blush canvas, cream cards. Pure white only inside QR codes. No pure black:
   text is deep plum. The app is colorful and daylight-friendly, **not** a dark theme.
2. **Wine is the brand, scarlet/blue are the teams.** Wine = primary actions and identity. Scarlet (red)
   and blue mean team membership only. Gold = highlights (VS, dice/randomize, "Pokémon" battle button).
3. **Readable from 3 m.** Host text ≥ 22 px on the 1920×1080 stage. Phone text ≥ 13 px, tap targets ≥ 44 px.
4. **Decoration stays in the background.** Poké Ball outlines, dot grid and diagonal stripes at low
   opacity. Never behind body text.
5. **Chunky and tactile.** Solid offset shadows, 3D buttons whose bottom edge collapses on press, rounded
   corners. Pixel art stays pixelated (`image-rendering: pixelated`).
6. **State = icon + color + word.** Never color alone (e.g. `✓ Ready`, not just a green dot).

## Tokens

Tailwind 4 `@theme static` in `apps/web/src/index.css` (the implemented file also adds `--color-line`,
`--color-qr`, `--color-warn-deep`, `--color-hp-mid`, the `--color-type-*` palette and the `lift`/`float`
shadows):

```css
@theme {
  /* ink */
  --color-ink: #2b1722;
  --color-ink-2: #5b4150;
  --color-muted: #927a86;
  /* surfaces */
  --color-canvas: #f6e6e3;
  --color-canvas-deep: #e8cdc9; /* stage letterbox, fallbacks */
  --color-paper: #fffaf6; /* cards */
  --color-paper-2: #f6ebe5; /* insets, disabled */
  /* brand */
  --color-wine: #7d1d3f;
  --color-wine-2: #9e2a52;
  --color-wine-deep: #4f0f26; /* 3D edges */
  --color-wine-soft: #f2cdd8;
  --color-wine-tint: #fbedf1;
  --color-gold: #ffc93c;
  --color-gold-deep: #d49a00;
  --color-gold-soft: #fff0c2;
  /* teams (reserved) */
  --color-team-red: #e8432d;
  --color-team-red-deep: #ad2a17;
  --color-team-red-soft: #ffd0c4;
  --color-team-red-tint: #ffede7;
  --color-team-blue: #2f6fd6;
  --color-team-blue-deep: #1b4aa0;
  --color-team-blue-soft: #c9dcff;
  --color-team-blue-tint: #eaf1ff;
  /* feedback */
  --color-ok: #1e9e6a;
  --color-ok-deep: #147550;
  --color-ok-soft: #d4f3e4;
  --color-warn: #e98a0c;
  --color-warn-soft: #ffe9c7;

  --font-display: 'Lilita One', 'Rubik', system-ui, sans-serif;
  --font-sans: 'Rubik', system-ui, -apple-system, 'Segoe UI', sans-serif;

  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 28px;
  --radius-xl: 36px;
}
```

**Pokémon type colors** (moves only; community-standard values): normal `#a8a77a`, fire `#ee8130`,
water `#6390f0`, electric `#f7d02c`, grass `#7ac74c`, ice `#96d9d6`, fighting `#c22e28`, poison `#a33ea1`,
ground `#e2bf65`, flying `#a98ff3`, psychic `#f95587`, bug `#a6b91a`, rock `#b6a136`, ghost `#735797`,
dragon `#6f35fc`, dark `#705746`, steel `#b7b7ce`, fairy `#d685ad`. Use ink text on the light ones
(normal, electric, ground, ice, steel, rock, bug, grass, fairy, flying), white text on the rest.

**Mega Evolution** (toggle, tags, glow; not a team color): `mega` `#b04fd3`, `mega-deep` `#6a1f8a`,
`mega-soft` `#f3e4ff`, `mega-tint` `#ffe7f1`. `line` = `rgb(43 23 34 / .14)` (hairlines, HP bar track).

**Depth:** `lift` = `0 6px 0 rgb(43 23 34 / .12)`; `float` = `0 18px 40px rgb(79 15 38 / .18)`.
3D button = `box-shadow: 0 6px 0 <deep color>` → on `:active` `translateY(5px)` + `0 1px 0`.

## Typography

**Lilita One** (display: titles, room code, FIGHT/Pokémon, big CTAs) + **Rubik** 400–900 (everything
else). Self-host with Fontsource (no Google Fonts requests at runtime).

| Role       | Host (stage px)               | Phone (px)                   |
| ---------- | ----------------------------- | ---------------------------- |
| Display XL | 92 Lilita (room code tiles)   | 58 Lilita (FIGHT)            |
| Display    | 60–76 Lilita                  | 24–30 Lilita                 |
| Title      | 44 Rubik 800 (player name)    | 17–20 Rubik 800              |
| Body       | 24–30 Rubik 600               | 14–16 Rubik 500              |
| Label      | 20–24 Rubik 900, caps, +.12em | 11–13 Rubik 900, caps, +.1em |

## Components

- **Buttons:** `primary` (wine), `gold` (accent/secondary emphasis), `ghost` (paper + 3 px ink ring),
  `ok` (green, confirm/ready), `team-red` / `team-blue` (only for team actions), `disabled` (paper-2, muted).
  One primary per screen.
- **Icon button:** 44 px square, paper-2, hover wine-soft; `danger` variant turns scarlet on hover.
- **Poké Ball (CSS, no image):** band ≈ 9% of the diameter, center button ≈ 26% with a ring in the edge
  color. **Brand ball = monochrome wine** (top `wine-2`, bottom `wine`, band/edge `wine-deep`, button
  `wine-tint`, small top-left gloss). Used for the logo and loaders (spin while waiting; "catch wobble" when
  everyone is ready). Colored variants: team balls (top = team color), counters (`empty` = outline only).
- **Status pill:** `✓ Ready` (ok-soft/ok-deep) · `Building` (warn-soft + blinking dot) · `Pending` (muted).
- **Team chip / badge:** team color + white Poké Ball + name, with 4–5 px bottom edge in the deep shade.
- **Code chip:** paper, Lilita, letter-spacing .18em, wine text.
- **Player card (Host):** paper card with the trainer sprite on an elliptical "battle platform" in the team
  tint. Disconnected = paper-2 background + grayscale sprite + "Disconnected". Kick button on hover (lobby).
- **Bottom sheet (phone):** details and confirmations slide up from the bottom over a plum 45% backdrop;
  tapping the backdrop closes. Actions row = ghost `Close` + primary action.
- **HP bar:** green > 50% · yellow `#f2b705` ≤ 50% · scarlet ≤ 20%.

## Decoration

- Canvas: dot grid (wine 8%, 26–32 px) + large Poké Ball outlines at 5–8% opacity in corners.
- Team panels: team tint → soft gradient + white diagonal stripes (28% alpha) + light Poké Ball outline in
  a corner.
- Phones: team-tinted gradient + dots + light Poké Ball outline behind the header area.

## Screens

### Home (responsive)

Logo + language chip · hero title "Your phone. Your team. Your battle." · one lead paragraph ·
**Host a battle** (primary) + inline room-code join (gold) · TV + phones illustration on the right (hidden
< 520 px) · legal disclaimer at the bottom (mandatory). No feature chips, no "how it works" section.

**On phones (D-50, coarse pointer):** no Host button — the lead talks about scanning the big screen's QR,
then the room-code join and a full-width ghost **Team builder** button (→ `/teams`).

### Team builder page `/teams` (phone, D-53)

Same phone shell as the controller, neutral wine theme. **List:** back + logo, "My teams" + hint, saved
teams as cards (name, mini sprites, ✏️ edit, 🗑 delete), **Import from text** (ghost) and **New team**
(primary) pinned at the bottom. **Team:** back (asks "Discard changes?" when edited) + "New team" / "Edit
team" · team name field · "N / 6 Pokémon" · the same Pokémon cards and dashed "+ Add Pokémon" / 🎲 row as
in a room · export (📋 icon, sheet with Copy) + **Save team**. Editing a Pokémon opens the same editor.
Importing more than 6 Pokémon asks which to keep (see below).

### Host (1920×1080 `Stage`, scaled)

- **Header:** logo left; right: language pill, fullscreen, close room. No phase stepper.
- **Language pill (Home and Host):** globe + language name + ▾ opening our own menu (paper card,
  float shadow, options in their own language, active row wine-tint, ✓ on the current one); never the
  native `<select>` list. Spanish labels are kept short so headers and buttons never wrap ("Equipo red",
  "2 / 2", "Espacio libre").
- **Lobby:** left = title + format segmented control (Singles / Doubles) · two team panels with a gold
  "VS" burst between them (112 px, above the panels) · open slots shown dashed · footer = composition status card + **Start game**
  (disabled while invalid). Right = **wine join panel** (560 px): room code as 4 tiles, QR on white, URL,
  3 join steps, seat counter.
- **Team building:** no join panel; small room-code pill in the header. Centered title "Team building" ·
  red panel | spinning brand Poké Ball + "N / M ready" | blue panel · each player shows only
  Ready / Building / Pending · footer: **Cancel** (ghost, back to lobby); **Battle!** (primary) appears when
  everyone is ready (see open item O-11 in `08-decisions.md`).

### Host battle scene (1920×1080 stage)

- **Field:** rounded panel, sky (wine-tint → gold-soft) over grass (type-grass tints), light Poké Ball
  outline. Red (p1) is near: back sprite bottom-left on a red-tint platform, trainer sprite in the corner;
  blue (p2) is far: front sprite top-right on a blue-tint platform, trainer top-right.
- **Side cards:** paper with a team ring + deep bottom edge: trainer name, Mega stone mark (available /
  used, greyed), Poké Ball row (fainted = grey), Pokémon name + Lv, HP bar with **percent only** (the
  public value), status tag (type-colored), Mega tag, stat stages, side conditions with turns left of
  their total ("Reflect · 3/5"; "… · 2/8" once an unseen Light Clay visibly extended it, D-56) or hazard layers
  ("Spikes ×2"), "● Choosing" pill.
- **Top center chips:** turn, turn timer (blinking dot), weather / terrain / field effects with turns left of
  their total ("Rain · 1/4" = 1 turn left of 4, "Trick Room · 2/5").
- **Close room (D-57):** exit icon at the right of the header → confirmation dialog ("Close this room?") →
  the room ends for everyone and the Host goes back to Home.
- **Field effects (D-55, own CSS):** weather over the whole field (rain streaks, sun glow, sand haze,
  snow flakes, wind), terrain as a tint over the grass (Electric / Grassy / Misty / Psychic type colors),
  Trick Room as a faint psychic grid, Reflect / Light Screen / Aurora Veil as translucent walls in front
  of that side's Pokémon, Tailwind streaks, hazards on that side's ground (Stealth Rock rocks, Spikes and
  Toxic Spikes one set per layer, a Sticky Web). Decorative only: the chips keep the turns left. Top chips
  never break inside; the row wraps whole chips.
- **Substitute:** the doll (self-hosted Showdown gen5 sprite, 1.6×, base on the platform) replaces the
  Pokémon while it lasts; "Substitute" tag (grass-green tint) on the side card and on the phone.
- **Stat changes:** floating badge over the Pokémon ("▲ Attack +2" ok colors / "▼ Defense −1" scarlet,
  30 px, rises and fades in 1.4 s) + green / red glow on the boost / unboost animation; stages on the
  side card and the phone's active card as ▲ green / ▼ red tags with short stat names.
- **Doubles (Phase 3, D-48):** two platforms per side with smaller sprites and trainers; the far side is
  mirrored (p2a on the right, facing p1a), so "left / right" on the TV is what the phones' target picker
  shows. Side cards get narrower and list one compact row per position (name, HP bar, %, then status /
  Mega / stat stage tags), with one Mega mark per Mega of the side's budget (greyed as used) and, when two
  trainers share the side, a "Name ● Choosing" pill per trainer. Special-move orbs fly from the user's slot
  to the target's slot; Ally Switch swaps the two slots.
- **Narration box:** paper strip under the field, previous line muted (26 px) + current line (40 px Rubik
  800); "Space: skip animations" hint.
- **Generic animations (own CSS, nothing from pokemon-showdown-client):** switch-in pop with flash,
  physical lunge, special orb in the move's type color, status/effect glow, hit blink, heal/boost/unboost,
  faint drop + fade, Mega flash + a permanent Mega aura. Durations 0.3–1.5 s per event.
- **Countdown / results:** big Lilita number with a gold shadow; results banner in the winner's deep team
  color, both team panels (loser dimmed) with KOs and remaining Poké Balls, **Rematch** (primary) and
  **Back to lobby** (ghost).
- **Battle log panel (D-33):** right column of ~420 px on the stage, full height
  of field + narration; the field shrinks to ~1390 px (slots, cards and projectile paths re-positioned).
  Paper card with its own scroll, auto-scrolled to the bottom. Turn dividers "Turn N" (Lilita 26 px, wine);
  lines in Rubik 600 22 px (readable from 3 m), each prefixed with a dot in the acting side's team color;
  move names bold; the newest line in ink, older ones ink-2. Shows only what the playback has already
  shown. `L` toggles it (remembered in localStorage); hidden → the field uses the full width.
- **Audio (D-32):** Host only. Sound toggle (🔊 / 🔇 icon button) next to fullscreen in the header, plus a
  volume setting; unlocked by the first click. Defaults: music 40 %, effects 80 %. Phones: silent,
  vibration only. Battle feedback sounds (ZzFX, `host/audio/sounds.ts`): stat stages as a rising (raise) /
  falling (drop) arpeggio with one more note per stage (±1 / ±2 / ±3+); a bright two-tone ding for
  ability call-outs (including `-activate` abilities); distinct sounds for Protect, cures, items (berries,
  Focus Sash, Knock Off, Frisk, Trick…), weather, terrain / rooms, timed side conditions (screens,
  Tailwind) vs entry hazards, and a soft fade when an effect ends.

### Controller (phone, portrait only)

The phone is themed with the player's **team** colors; before joining it uses the neutral wine/blush theme.
Primary action pinned to the bottom.

**Fullscreen:** "Join room" enters fullscreen on touch devices. While seated, if the page is not
fullscreen (back gesture, reload), a full-screen **"Tap to continue"** prompt (AirConsole-style) covers the
phone; the tap re-enters fullscreen. Skipped where the API is missing (iPhone Safari) and on desktop.
On the Host, "Host a battle" (Home) enters fullscreen; the header button toggles it.

1. **Join:** name input · scrollable 4-column grid of all trainers (selected = gold-soft + wine ring) ·
   dice button for a random trainer · **Join room**.
2. **Teams:** Red card above Blue card, each with its players and a "Join Team X" button ("✓ You're on
   this team" on your own) · "Waiting for the host…" · **Leave room** (ghost).
3. **Team builder:** "Your team N / quota" + ☰ Team options · Pokémon cards: icon, name, item icon +
   `@ item`, ability, nature, the 4 moves (no type chips) · ✏️ edit and ✕ remove icon buttons · dashed "+ Add
   Pokémon" with a dashed 🎲 tile (random) · **Randomize** (gold, fills the missing slots, or rerolls a full
   team) · **I'm ready** (green; disabled below the minimum: a solo doubles player needs 2 Pokémon, with
   the hint under it). The list is always compact: Pokémon first, empty slots at the bottom
   (removing one moves the ones below up).
   - **Editor (full view, Phase 2):** back + title + 🎲 (a random **set** for this species: moves,
     ability, nature, SP, item — D-52; a random Pokémon is the list's 🎲) · species card
     (sprite, name, type chips, "Change ✏️") · rows Item / Nature (tap → picker) with a Mega Stone hint ·
     Ability as radio chips (selected = team color + ✓) with its description · Moves: one type-colored row
     per move (category · power) + ✕, dashed "+ Add a move" · **Stat Points** card: "N / 66 left", per stat
     base value, − / + (36 px), slider (team `accent-color`), resulting Lv 50 stat; the nature's raised
     stat ▲ on ok-soft/ok-deep, lowered ▼ on scarlet tint/deep (always with the arrow) · pinned bottom:
     🗑 (ghost, existing Pokémon) + **Save** (primary). Validator errors show under the form.
   - **Pickers:** full-screen over the phone (team gradient + dots), back + title, search field (autofocus),
     paper rows with a soft team edge; at most 60 rows, then "N more · keep typing". Species rows: sprite,
     name, type chips, BST; species already on your team are disabled with "In your team". Moves: type
     chip, name, category · power · accuracy, short description. Items: "No item" first, "For this
     Pokémon" (Mega Stones, required items) before all items; each row has the item icon (24 px ×1.5,
     pixelated, on a team-tint tile). The editor's Item field shows the icon next to the name.
   - **Nature picker (by effect, not by name):** card "▲ Raises" with 5 stat buttons (Atk, Def, SpA, SpD,
     Spe; selected = ok-soft + green ring + ▲), card "▼ Lowers" with the same 5 (selected = scarlet tint +
     red ring + ▼), a "Neutral nature" chip (the same stat twice also means neutral). A result card shows
     the nature's name (Lilita 34 px) and its effect on this Pokémon with its current Stat Points
     ("▲ Atk 182 → 200", "▼ SpA 100 → 90"). Pinned **Use Adamant** (primary) confirms; disabled until both
     stats are picked.
   - **Team options (sheet):** Import from text · Export as text (copy) · Save this team, then "Saved on this
     phone" (name, mini sprites, **Load**, 🗑).
   - **Choose your Pokémon (D-54):** when a pasted or saved team has more Pokémon than the slots, the
     sheet lists them (sprite + name, checkbox rows, the first ones preselected, "2 / 3 chosen") and
     **Import N Pokémon** imports only those.
4. **Battle (3DS lower-screen model):**
   - **Steps (doubles, Phase 3):** one step per position the player controls (a solo doubles player has
     two): a "1 / 2" chip before the prompt, "← Back to X" to redo the previous position; the last step
     sends everything. Forced switches work the same ("Pick who replaces X"; a Pokémon picked for the
     first hole shows "Chosen").
   - **Menu:** active Pokémon card (name, Lv, HP) + ally line in doubles ("Beside it: X · 64%", public
     HP) · "What will X do?" ·
     **FIGHT** (wine) and **Pokémon** (gold) split **60 / 40** of the free height · small Forfeit link
     (confirmation sheet) · turn timer chip in the header.
   - **Fight:** back button · Mega Evolve toggle · **one move per row** (type color background, name, type
     label, PP). **First tap selects** (ring + "Tap again to use") and enables **Details**; **second tap
     uses** the move.
   - **Move details (sheet):** type, category (Physical/Special/Status), power, accuracy, PP, description,
     **Use move**.
   - **Target (doubles, single-target moves only):** "Move: choose a target" · "Opponents" row + "Your
     side" row, left → right as on the TV, two big cards per row (sprite, name, public HP bar); the ally is
     allowed but tagged "⚠ Your ally", the user itself only for moves like Acupressure ("Itself");
     fainted / empty positions disabled. Spread and self moves skip this step, and so does a move with a
     single standing target.
   - **Mega toggle in doubles:** disabled (dimmed + hint) when the ally already Mega Evolves this turn or
     an earlier position of the same player does; hidden once the player's quota is spent.
   - **Pokémon:** your share of the team with HP and tags (In battle / Fainted); tap → details sheet (item,
     ability, HP, nature "Jolly (▲ Spe · ▼ SpA)", one row per stat: name, value and a **Stat Points bar**
     (0–32, team color) with "+32", so the player sees where the build is focused; the nature's raised
     row is green with ▲, the lowered one red with ▼, neutral natures mark nothing; stat stages of the
     active Pokémon as ▲/▼ tags; moves) with **Switch in**.
   - **Waiting:** summary of the choice, one line per position ("Garchomp · **Dragon Claw** → Snorlax",
     - Mega tag), spinning brand ball, **Undo**. Wait screens: "The other trainer(s) are choosing…", and
       "Your Pokémon are out. Cheer on your ally!" for a 2v2 player with nothing left.
   - **Pokémon sheet:** the item row shows the item icon. **Forfeit** with a teammate warns that the whole
     team loses (D-47).

## Implementation notes

- Keep the architecture rules: all strings are i18n keys, sprites self-hosted, no CSS copied from
  `pokemon-showdown-client`.
- Shared primitives live in `apps/web/src/components/ui/` (`Button`, `IconButton`, `Icon`, `PokeBall`,
  `StatusPill`, `TeamChip`, `HpBar`, `Logo`, `CodeChip`, `Sheet`); reuse them on Host and Controller.
  Pokémon sprites go through `components/PokemonSprite` (manifest-based, see `10-development.md`).
- Fonts are self-hosted with Fontsource (`@fontsource/lilita-one`, `@fontsource/rubik`, imported in
  `main.tsx`).
- Pokémon icons: the self-hosted front sprite shrunk into the tile (the icon sheet is not used yet).
  Item icons: `components/ItemIcon` cuts the self-hosted item icon sheet (24 px, `scale` prop, always next
  to the item name, so decorative for screen readers).
- The mockup's QR and battle data are fake; real QR stays `qrcode.react`.
