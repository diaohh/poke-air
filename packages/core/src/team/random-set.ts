import { BATTLE_LEVEL, type PokemonSetData, type StatTable } from '@poke-air/shared';
import {
  getChampionsDex,
  SHOWDOWN_FORMATS,
  Teams,
  type ShowdownDex,
  type ShowdownSet,
} from '../battle/showdown.js';
import { learnableMoves } from './legality.js';

type DexSpecies = ReturnType<ShowdownDex['species']['get']>;
type DexMove = ReturnType<ShowdownDex['moves']['get']>;

/** The slice of Showdown's Champions random team generator we use. */
interface ChampionsGenerator {
  /** Species id → role sets (311 species / formes in 0.11.11). */
  randomSets: Record<string, unknown>;
  randomSet(species: string): ShowdownSet;
}

let generator: ChampionsGenerator | undefined;
function championsGenerator(): ChampionsGenerator {
  generator ??= Teams.getGenerator(SHOWDOWN_FORMATS.randomSets) as unknown as ChampionsGenerator;
  return generator;
}

/**
 * Showdown's Champions random set for this species or one of its Megas (competitive sets built for
 * Champions), or `null` when the random data doesn't cover it. Not validated yet.
 */
export function championsRandomSet(species: DexSpecies, random: () => number): ShowdownSet | null {
  const dex = getChampionsDex();
  const sets = championsGenerator().randomSets;
  const megas = (species.otherFormes ?? [])
    .map((name) => dex.species.get(name))
    .filter((forme) => forme.exists && forme.isMega)
    .map((forme) => forme.id);
  const ids = [species.id, ...megas].filter((id) => id in sets);
  const id = ids[Math.floor(random() * ids.length)];
  return id ? championsGenerator().randomSet(id) : null;
}

/**
 * A reasonable set generated from the species' legal movepool, for the ~900 legal species without
 * Champions random sets (decision D-52): two STAB attacks and coverage in its better attacking
 * category, one self-targeting status move, nature and Stat Points on that stat and Speed (HP when
 * slow), its Mega Stone or required item when it has one. Not validated yet.
 */
export function generatedSet(species: DexSpecies, random: () => number): PokemonSetData {
  const dex = getChampionsDex();
  const shuffled = <T>(list: readonly T[]) =>
    list
      .map((value) => ({ value, key: random() }))
      .sort((a, b) => a.key - b.key)
      .map(({ value }) => value);
  const base = species.baseStats;
  const physical = base.atk > base.spa || (base.atk === base.spa && random() < 0.5);
  const attackStat = physical ? 'atk' : 'spa';

  const usable = learnableMoves(species)
    .map((id) => dex.moves.get(id))
    .filter(
      (move) =>
        move.exists &&
        !move.ohko &&
        !move.selfdestruct &&
        !move.flags.charge &&
        !move.flags.recharge &&
        !move.flags.futuremove,
    );
  const attacks = usable.filter(
    (move) => move.category === (physical ? 'Physical' : 'Special') && move.basePower >= 60,
  );
  const stab = attacks.filter((move) => species.types.includes(move.type));
  const coverage = attacks.filter((move) => !species.types.includes(move.type));
  const support = usable.filter((move) => move.category === 'Status' && move.target === 'self');

  const chosen: DexMove[] = [];
  const take = (pool: readonly DexMove[], count: number, distinctTypes = true) => {
    let taken = 0;
    for (const move of shuffled(pool)) {
      if (taken >= count || chosen.length >= 4) break;
      if (chosen.includes(move)) continue;
      if (distinctTypes && chosen.some((other) => other.type === move.type)) continue;
      chosen.push(move);
      taken++;
    }
  };
  take(stab, 2);
  take(coverage, Math.max(0, (support.length > 0 ? 3 : 4) - chosen.length));
  take(support, 1, false);
  take(attacks, 4 - chosen.length, false);
  take(usable, 4 - chosen.length, false);

  const fast = base.spe >= 80 && random() < 0.5;
  const plus = fast ? 'spe' : attackStat;
  const minus = physical ? 'spa' : 'atk';
  const nature = dex.natures.all().find((n) => n.plus === plus && n.minus === minus);
  const evs: StatTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  evs[attackStat] = 32;
  if (base.spe >= 60) {
    evs.spe = 32;
    evs.hp = 2;
  } else {
    evs.hp = 32;
    evs.def = 1;
    evs.spd = 1;
  }

  const abilities = Object.values(species.abilities).filter(Boolean) as string[];
  const megaStones = (species.otherFormes ?? [])
    .map((name) => dex.species.get(name))
    .filter((forme) => forme.exists && forme.isMega && forme.requiredItem)
    .map((forme) => forme.requiredItem as string);
  const required = species.requiredItems ?? (species.requiredItem ? [species.requiredItem] : []);
  const item =
    required[Math.floor(random() * required.length)] ??
    (megaStones.length > 0 && random() < 0.5
      ? megaStones[Math.floor(random() * megaStones.length)]
      : '');

  return {
    name: species.name,
    species: species.name,
    item: item ?? '',
    ability: abilities[Math.floor(random() * abilities.length)] ?? '',
    moves: chosen.map((move) => move.name),
    nature: nature?.name ?? 'Hardy',
    evs,
    level: BATTLE_LEVEL,
  };
}
