import type { MoveCategory } from './battle.js';
import type { StatId, StatTable } from './team.js';

/**
 * Compact team builder data for the phone (docs/13-phase-2-plan.md § B3). Generated from the
 * Showdown dex by `pnpm build:data` (packages/data) and served as static JSON: phones never load
 * the simulator. Everything is keyed and named as in Showdown (English), like the rest of the
 * protocol; the server validates every set again.
 */

/** Where the web app serves the generated file. */
export const TEAM_BUILDER_DATA_URL = '/data/teambuilder.json';

export interface DexSpecies {
  /** Showdown id, e.g. "rotomwash". */
  id: string;
  /** Display name, e.g. "Rotom-Wash". */
  name: string;
  /** Base species for Species Clause, e.g. "Rotom". */
  baseSpecies: string;
  /** National Dex number (list order). */
  num: number;
  types: string[];
  baseStats: StatTable;
  /** Ability names in slot order (0, 1, Hidden, Special). */
  abilities: string[];
  /** Indexes into `TeamBuilderData.moves` of every legal move. */
  learnset: number[];
  /** Mega Stones (item names) that Mega Evolve this species. */
  megaStones?: string[];
  /** Items this forme must hold (Arceus / Silvally formes, Ogerpon masks…). */
  requiredItems?: string[];
  /** Fixed max HP (Shedinja). */
  maxHP?: number;
}

export interface DexMove {
  id: string;
  name: string;
  type: string;
  category: MoveCategory;
  basePower: number;
  /** `true` = never misses. */
  accuracy: number | true;
  pp: number;
  priority: number;
  target: string;
  desc: string;
}

export interface DexItem {
  id: string;
  name: string;
  desc: string;
}

export interface DexNature {
  name: string;
  plus?: StatId;
  minus?: StatId;
}

export interface TeamBuilderData {
  /** `<pokemon-showdown version>:<generator version>`: the build script skips when unchanged. */
  stamp: string;
  species: DexSpecies[];
  moves: DexMove[];
  items: DexItem[];
  /** Ability name → short description. */
  abilities: Record<string, string>;
  natures: DexNature[];
}
