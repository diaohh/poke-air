import { getChampionsDex, SHOWDOWN_FORMATS, Teams } from '../battle/showdown.js';

/**
 * Species names a Phase 1 battle can show: everything the randomizer can produce plus the formes
 * those Pokémon can take mid-battle (Megas and battle-only formes such as Aegislash-Blade).
 * Used by `packages/data` to know which sprites to download.
 */
export function battleRoster(): string[] {
  const dex = getChampionsDex();
  const generator = Teams.getGenerator(SHOWDOWN_FORMATS.randomSets) as unknown as {
    randomSets: Record<string, unknown>;
  };
  const names = new Set<string>();

  for (const id of Object.keys(generator.randomSets)) {
    const species = dex.species.get(id);
    if (!species.exists) continue;
    names.add(species.name);
    for (const forme of species.otherFormes ?? []) {
      const other = dex.species.get(forme);
      if (other.exists && (other.isMega || other.battleOnly)) names.add(other.name);
    }
  }
  return [...names].sort();
}
