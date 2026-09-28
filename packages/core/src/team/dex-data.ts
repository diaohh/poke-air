import {
  STAT_IDS,
  type DexItem,
  type DexMove,
  type DexNature,
  type DexSpecies,
  type MoveCategory,
  type StatTable,
  type TeamBuilderData,
} from '@poke-air/shared';
import { getChampionsDex } from '../battle/showdown.js';
import { learnableMoves, legalItems, legalSpecies } from './legality.js';

/** Bump when the shape or the selection logic of the generated data changes. */
export const TEAM_BUILDER_DATA_VERSION = 4;

/**
 * Builds the phone's team builder data from the Champions dex and the Casual ruleset
 * (decision D-36): legal species with their legal moves, legal items, abilities and natures.
 * Takes a few seconds (one validator check per species × move): run it at build time only.
 */
export function buildTeamBuilderData(stamp: string): TeamBuilderData {
  const dex = getChampionsDex();
  const moveIndex = new Map<string, number>();
  const moves: DexMove[] = [];
  const abilities: Record<string, string> = {};

  const items: DexItem[] = legalItems()
    .map((item) => ({ id: item.id, name: item.name, desc: item.shortDesc || item.desc }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const itemNames = new Set(items.map((item) => item.name));

  const indexOf = (id: string): number => {
    let index = moveIndex.get(id);
    if (index === undefined) {
      const move = dex.moves.get(id);
      index = moves.length;
      moveIndex.set(id, index);
      moves.push({
        id: move.id,
        name: move.name,
        type: move.type,
        category: move.category as MoveCategory,
        basePower: move.basePower,
        accuracy: move.accuracy,
        pp: move.pp,
        priority: move.priority,
        target: move.target,
        desc: move.shortDesc || move.desc,
      });
    }
    return index;
  };

  const species: DexSpecies[] = legalSpecies()
    .slice()
    .sort((a, b) => a.num - b.num || a.name.localeCompare(b.name))
    .map((forme) => {
      const names = Object.values(forme.abilities).filter(Boolean);
      for (const name of names) {
        const ability = dex.abilities.get(name);
        abilities[ability.name] ??= ability.shortDesc || ability.desc;
      }
      const learnset = learnableMoves(forme)
        .sort((a, b) => a.localeCompare(b))
        .map(indexOf);
      const entry: DexSpecies = {
        id: forme.id,
        name: forme.name,
        baseSpecies: forme.baseSpecies,
        num: forme.num,
        types: [...forme.types],
        baseStats: statTable(forme.baseStats),
        abilities: names,
        learnset,
      };
      const megaStones = (forme.otherFormes ?? [])
        .map((name) => dex.species.get(name))
        .filter((other) => other.exists && other.isMega && other.requiredItem)
        .map((other) => other.requiredItem as string)
        .filter((item) => itemNames.has(item));
      if (megaStones.length > 0) entry.megaStones = megaStones;
      // Megas triggered by a move instead of a stone (Rayquaza → Dragon Ascent, decision D-41).
      const megaMove = (forme.otherFormes ?? [])
        .map((name) => dex.species.get(name))
        .find((other) => other.exists && other.isMega && other.requiredMove)?.requiredMove;
      if (megaMove) entry.megaMove = megaMove;
      const required = (
        forme.requiredItems ?? (forme.requiredItem ? [forme.requiredItem] : [])
      ).filter((item) => itemNames.has(item));
      if (required.length > 0) entry.requiredItems = [...required];
      if (forme.maxHP) entry.maxHP = forme.maxHP;
      return entry;
    });

  const natures: DexNature[] = dex.natures
    .all()
    .map((nature) => ({
      name: nature.name,
      ...(nature.plus ? { plus: nature.plus } : {}),
      ...(nature.minus ? { minus: nature.minus } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { stamp, species, moves, items, abilities, natures };
}

function statTable(source: Partial<StatTable>): StatTable {
  const table = {} as StatTable;
  for (const stat of STAT_IDS) table[stat] = source[stat] ?? 0;
  return table;
}
