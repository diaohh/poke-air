# Host audio files

Sound effects need no files (they are synthesized with ZzFX, see `apps/web/src/host/audio/sounds.ts`).
This folder holds the **optional** files; anything missing is simply skipped.

## Music (`music/`, CC0 — may be committed)

| File                | When it plays                   | Loop |
| ------------------- | ------------------------------- | ---- |
| `music/lobby.mp3`   | Lobby and team building         | yes  |
| `music/battle.mp3`  | During the battle               | yes  |
| `music/victory.mp3` | Results screen (a short jingle) | no   |

Use **CC0** tracks only (e.g. OpenGameArt filtered by CC0, Kenney "Music Jingles" for the victory),
MP3, mono or stereo at ~96 kbps, each under ~1 MB. Add every file to `CREDITS.md`. Official Pokémon
music is not used (docs/03-data-sources-and-licensing.md § Audio).

## Cries (`cries/`, git-ignored — never commit)

Downloaded by `pnpm fetch:audio` together with `cries-manifest.json`. Nintendo / The Pokémon Company
assets: same rules as sprites. They can be turned off in the Host's sound menu.
