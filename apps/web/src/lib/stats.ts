import {
  STAT_IDS,
  STAT_POINTS_MAX,
  STAT_POINTS_TOTAL,
  type DexNature,
  type DexSpecies,
  type StatId,
  type StatTable,
} from '@poke-air/shared';

/**
 * Champions stats at level 50 (spike S3, `mods/champions/scripts.ts` `statModify`): IVs are fixed
 * and every Stat Point adds one point. The server's simulator is the authority; this only previews.
 *   HP    = base + SP + 75
 *   other = floor((base + SP + 20) × 1.1 / 0.9 for the nature's raised / lowered stat)
 */
export function calcStat(
  stat: StatId,
  base: number,
  points: number,
  nature: DexNature | undefined,
): number {
  if (stat === 'hp') return base + points + 75;
  const raw = base + points + 20;
  if (nature?.plus === stat) return Math.floor((raw * 110) / 100);
  if (nature?.minus === stat) return Math.floor((raw * 90) / 100);
  return raw;
}

export function calcStats(
  species: DexSpecies,
  points: StatTable,
  nature: DexNature | undefined,
): StatTable {
  const stats = {} as StatTable;
  for (const stat of STAT_IDS) {
    stats[stat] = calcStat(stat, species.baseStats[stat], points[stat], nature);
  }
  if (species.maxHP) stats.hp = species.maxHP;
  return stats;
}

export function totalPoints(points: StatTable): number {
  return STAT_IDS.reduce((sum, stat) => sum + points[stat], 0);
}

/** Highest value `stat` can take without breaking the per-stat or the total limit. */
export function maxPointsFor(points: StatTable, stat: StatId): number {
  const others = totalPoints(points) - points[stat];
  return Math.max(0, Math.min(STAT_POINTS_MAX, STAT_POINTS_TOTAL - others));
}

export const EMPTY_POINTS: StatTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
