/**
 * Team contracts. `PokemonSetData` is a JSON-safe subset of Showdown's `PokemonSet`; `shared` never
 * imports `pokemon-showdown` (the web app imports this package), so `core` maps between the two.
 */

export const STAT_IDS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
export type StatId = (typeof STAT_IDS)[number];
export type StatTable = Record<StatId, number>;

export interface PokemonSetData {
  /** Nickname (random sets use the species name). */
  name: string;
  /** Species display name, e.g. "Rotom-Wash". */
  species: string;
  /** Item display name ("" for none). */
  item: string;
  /** Ability display name. */
  ability: string;
  /** Move display names (up to 4). */
  moves: string[];
  nature?: string;
  gender?: string;
  /** Champions mod: Stat Points live in `evs` (66 total, 32 max per stat). */
  evs: StatTable;
  ivs?: StatTable;
  level: number;
  shiny?: boolean;
}

/** Owner-only team view (`team:state`): one entry per slot of the player's quota. */
export interface TeamState {
  quota: number;
  /** Pokémon needed to be Ready: 2 for a solo Doubles player (a side needs two), else 1. */
  minimum: number;
  slots: (PokemonSetData | null)[];
}

/** Showdown-style ID: lowercase letters and digits only ("Rotom-Wash" → "rotomwash"). */
export function toId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
