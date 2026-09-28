import { STAT_IDS, toId, type PokemonSetData, type StatTable } from '@poke-air/shared';
import { RoomError } from '../rooms/room-error.js';
import { getChampionsDex, SHOWDOWN_FORMATS, Teams, type ShowdownSet } from '../battle/showdown.js';

/** Returns a batch of Showdown sets (a random team of 6 in production). */
export type SetGenerator = () => ShowdownSet[];

/** Champions rule: every Pokémon battles at level 50 (random sets come with 47–58). */
export const BATTLE_LEVEL = 50;

/** Safety net: each batch yields ~6 sets, so this is far more than any quota needs. */
const MAX_BATCHES = 25;

const defaultGenerator: SetGenerator = () => Teams.generate(SHOWDOWN_FORMATS.randomSets);

/**
 * Builds teams from Showdown's Champions random sets (docs/05-game-rules-and-mechanics.md §
 * Randomizer). Randomizer output is trusted in Phase 1: no `TeamValidator` yet (spike S3).
 */
export class TeamService {
  constructor(private readonly generate: SetGenerator = defaultGenerator) {}

  /**
   * `count` random sets with distinct base species that are not in `excludeSpecies`
   * (Species Clause across the whole side, teammates included).
   */
  randomSets(count: number, excludeSpecies: Iterable<string> = []): PokemonSetData[] {
    const used = new Set([...excludeSpecies].map((species) => this.baseSpeciesId(species)));
    const picked: PokemonSetData[] = [];

    for (let batch = 0; picked.length < count; batch++) {
      if (batch >= MAX_BATCHES) throw new RoomError('INTERNAL_ERROR');
      for (const set of this.generate()) {
        const base = this.baseSpeciesId(set.species);
        if (used.has(base)) continue;
        used.add(base);
        picked.push(this.toSetData(set));
        if (picked.length === count) break;
      }
    }
    return picked;
  }

  /** "Rotom-Wash" → "rotom": the unit of Species Clause. */
  baseSpeciesId(species: string): string {
    const found = getChampionsDex().species.get(species);
    return found.exists ? toId(found.baseSpecies) : toId(species);
  }

  /** Showdown packed team format, as `>player` expects it. */
  static pack(sets: PokemonSetData[]): string {
    return Teams.pack(sets as unknown as ShowdownSet[]);
  }

  private toSetData(set: ShowdownSet): PokemonSetData {
    const dex = getChampionsDex();
    const data: PokemonSetData = {
      name: set.name || set.species,
      species: dex.species.get(set.species).name || set.species,
      item: set.item ? dex.items.get(set.item).name || set.item : '',
      ability: dex.abilities.get(set.ability).name || set.ability,
      moves: set.moves.map((move) => dex.moves.get(move).name || move),
      evs: statTable(set.evs, 0),
      level: BATTLE_LEVEL,
    };
    if (set.nature) data.nature = dex.natures.get(set.nature).name || set.nature;
    if (set.gender) data.gender = set.gender;
    if (set.ivs) data.ivs = statTable(set.ivs, 31);
    if (set.shiny) data.shiny = true;
    return data;
  }
}

function statTable(source: Partial<StatTable> | undefined, fallback: number): StatTable {
  const table = {} as StatTable;
  for (const stat of STAT_IDS) table[stat] = source?.[stat] ?? fallback;
  return table;
}

let shared: TeamService | undefined;
/** Process-wide default (the dex and random-set data are loaded once). */
export function defaultTeamService(): TeamService {
  shared ??= new TeamService();
  return shared;
}
