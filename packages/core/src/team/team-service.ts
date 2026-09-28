import {
  BATTLE_LEVEL,
  STAT_IDS,
  toId,
  type PokemonSetData,
  type StatTable,
} from '@poke-air/shared';
import { RoomError } from '../rooms/room-error.js';
import { getChampionsDex, SHOWDOWN_FORMATS, Teams, type ShowdownSet } from '../battle/showdown.js';
import { casualValidator } from './legality.js';

export { BATTLE_LEVEL };

/** Returns a batch of Showdown sets (a random team of 6 in production). */
export type SetGenerator = () => ShowdownSet[];

/** Safety net: each batch yields ~6 sets, so this is far more than any quota needs. */
const MAX_BATCHES = 25;

const defaultGenerator: SetGenerator = () => Teams.generate(SHOWDOWN_FORMATS.randomSets);

/**
 * Builds and validates teams (docs/05-game-rules-and-mechanics.md, docs/13-phase-2-plan.md § B1):
 * Showdown's Champions random sets for the randomizer (trusted: 0 validator rejections measured)
 * and the Casual `TeamValidator` for edited and imported sets.
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

  /**
   * Checks a set against the Casual ruleset and returns it normalized (dex names, level 50,
   * nickname = species, no IVs/shiny). Throws `INVALID_SET` with Showdown's problem lines in
   * `details` (English, decision D-38).
   */
  validateSet(set: PokemonSetData): PokemonSetData {
    const evs = statTable(set.evs, 0);
    let nature = set.nature ?? '';
    // Showdown rejects 0 Stat Points with the default neutral nature ("did you forget to invest?")
    // unless another neutral nature says it was intended. Casual play allows it: Hardy is neutral too.
    if (STAT_IDS.every((stat) => evs[stat] === 0) && (!nature || toId(nature) === 'serious')) {
      nature = 'Hardy';
    }
    const candidate = {
      name: set.species,
      species: set.species,
      item: set.item,
      ability: set.ability,
      moves: [...set.moves],
      nature,
      gender: set.gender === 'M' || set.gender === 'F' ? set.gender : '',
      evs,
      ivs: statTable(undefined, 31),
      level: BATTLE_LEVEL,
    } as ShowdownSet;
    // The validator normalizes in place (e.g. "Charizard-Mega-X" → Charizard holding its stone).
    const problems = casualValidator().validateSet(candidate, {});
    if (problems && problems.length > 0) {
      throw new RoomError('INVALID_SET', { details: problems.join('\n') });
    }
    return this.toSetData({ ...candidate, ivs: undefined } as unknown as ShowdownSet);
  }

  /**
   * Parses Showdown team text and validates every set. Nicknames, IVs, shiny and Tera types are
   * dropped (decisions D-37, D-07). Throws `INVALID_IMPORT` when nothing can be read.
   */
  importTeam(text: string): PokemonSetData[] {
    const sets = parseTeamText(text);
    if (!sets || sets.length === 0) throw new RoomError('INVALID_IMPORT');

    return sets.map((set) => {
      const data: PokemonSetData = {
        name: set.species,
        species: set.species,
        item: set.item ?? '',
        ability: set.ability ?? '',
        moves: (set.moves ?? []).filter(Boolean),
        evs: statTable(set.evs, 0),
        level: BATTLE_LEVEL,
      };
      if (set.nature) data.nature = set.nature;
      if (set.gender) data.gender = set.gender;
      try {
        return this.validateSet(data);
      } catch (error) {
        if (error instanceof RoomError && error.code === 'INVALID_SET') {
          const details = String(error.params?.details ?? '');
          throw new RoomError('INVALID_SET', { details, species: set.species });
        }
        throw error;
      }
    });
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
    const species = dex.species.get(set.species).name || set.species;
    const data: PokemonSetData = {
      // Nicknames are not supported (decision D-37): idents stay unique thanks to Species Clause.
      name: species,
      species,
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

/** Showdown's team text parser; `null` when the text is not a team. */
function parseTeamText(text: string): ShowdownSet[] | null {
  try {
    return Teams.import(text);
  } catch {
    return null;
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
