import { getChampionsDex, SHOWDOWN_FORMATS, Teams } from '../battle/showdown.js';
import { legalSpecies } from './legality.js';

/**
 * Species names a battle can show: every species the team builder allows (decision D-40), the
 * randomizer's species, plus the formes those Pokémon can take mid-battle (Megas and battle-only
 * formes such as Aegislash-Blade). Used by `packages/data` to know which sprites to download.
 */
export function battleRoster(): string[] {
  const dex = getChampionsDex();
  const generator = Teams.getGenerator(SHOWDOWN_FORMATS.randomSets) as unknown as {
    randomSets: Record<string, unknown>;
  };
  const names = new Set<string>();
  const candidates = [
    ...Object.keys(generator.randomSets).map((id) => dex.species.get(id)),
    ...legalSpecies(),
  ];

  for (const species of candidates) {
    if (!species.exists) continue;
    names.add(species.name);
    for (const forme of species.otherFormes ?? []) {
      const other = dex.species.get(forme);
      if (other.exists && (other.isMega || other.isPrimal || other.battleOnly)) {
        names.add(other.name);
      }
    }
  }
  return [...names].sort();
}
