# Poke-Air

> Showdown-style Pokémon battles for **playing in the same room**: the big screen shows the battle,
> phones are the controllers. Inspired by Pokémon Showdown + AirConsole.

**Status:** v1 feature-complete, pending manual validation — singles and doubles (1v1 / 1v2 / 2v2)
battles on the big screen with private phone controls, full team builder (editor, import / export,
saved teams, item icons, a team builder page on the phone before joining), results and rematch.
Available in English and Spanish (Spain). Next: polish (Phase 5).

## Quick start

Requires Node ≥ 22.22 and pnpm 10.

```bash
pnpm install
pnpm fetch:sprites   # downloads trainer + Pokémon sprites and item icons (self-hosted, git-ignored)
pnpm fetch:audio     # optional: Pokémon cries (self-hosted, git-ignored)
pnpm dev             # builds the team builder data, then open http://localhost:5173/host on the PC; scan the QR with phones on the same Wi-Fi
```

More in [docs/10-development.md](./docs/10-development.md).

## How it plays (vision)

1. Open Poke-Air on a PC/TV → a **room code and QR** appear.
2. Friends scan the QR with their phones, type a name and pick a trainer avatar (Cynthia, Lance, Red…).
3. They split into **two teams** from their phones; the Host picks the battle format (singles or doubles).
4. **Team building** on the phone: a "meta" random team button, or edit each Pokémon (species, moves,
   item, ability, nature, Stat Points).
5. Everyone hits **Ready** → the battle plays on the big screen; each player secretly picks moves on their phone.

Supported compositions (v1): singles 1v1; doubles 1v1 / 1v2 / 2v2. Triples are a planned extension.
Mechanics follow a **Pokémon Champions–style** format: level 50, no IVs, Stat Points, Mega Evolution
(one per player).

## Documentation

- [CLAUDE.md](./CLAUDE.md) — technical summary and project rules
- [Vision & game flow](./docs/01-vision-and-game-flow.md)
- [Architecture](./docs/02-architecture.md)
- [Data sources & licensing](./docs/03-data-sources-and-licensing.md)
- [Battle modes](./docs/04-battle-modes.md)
- [Game rules & mechanics](./docs/05-game-rules-and-mechanics.md)
- [Internationalization](./docs/06-i18n.md)
- [Hosting & deployment](./docs/07-hosting-and-deployment.md)
- [Decisions](./docs/08-decisions.md)
- [Roadmap](./docs/09-roadmap.md)
- [Development guide](./docs/10-development.md)
- [Phase 1 plan](./docs/11-phase-1-plan.md)
- [Battle info + Phase 2 plan](./docs/13-phase-2-plan.md)
- [Phase 3 plan (doubles)](./docs/14-phase-3-plan.md)
- [Phase 4 (Spanish)](./docs/15-phase-4-plan.md)
- [Design system](./docs/12-design-system.md)

## Legal notice

Poke-Air is a **non-commercial fan project**, **not affiliated** with Nintendo, Game Freak, Creatures Inc.
or The Pokémon Company. Pokémon and all related names, sprites and characters are trademarks and
property of their respective owners.

Battle engine: [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) (MIT). Client helpers:
[@pkmn](https://github.com/pkmn/ps) (MIT). Sprites: Pokémon Showdown / Smogon Sprite Project / PokeAPI.
