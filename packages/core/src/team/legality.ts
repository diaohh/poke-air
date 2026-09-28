import {
  Dex,
  getChampionsDex,
  SHOWDOWN_FORMATS,
  TeamValidator,
  type ShowdownSet,
} from '../battle/showdown.js';

/**
 * The Casual ruleset's legality (spike S3, docs/13-phase-2-plan.md): Showdown's `TeamValidator`
 * on the Champions NatDex Draft format with the "anything goes" overrides. Used per set only
 * (`validateSet`): team size and Species Clause across teammates are the Room's job.
 */

type Validator = InstanceType<typeof TeamValidator>;
export type DexSpecies = ReturnType<ReturnType<typeof getChampionsDex>['species']['get']>;
export type DexItemEntry = ReturnType<ReturnType<typeof getChampionsDex>['items']['get']>;

/** Internals of the validator this module relies on (stable across 0.11.x, checked in S3). */
interface ValidatorInternals {
  format: {
    checkCanLearn?: (this: Validator, ...args: unknown[]) => string | null;
    onValidateSet?: (this: Validator, ...args: unknown[]) => string[] | void;
  };
  checkSpecies(set: ShowdownSet, species: DexSpecies, tier: DexSpecies, has: object): string | null;
  checkCanLearn(
    move: unknown,
    species: DexSpecies,
    sources: unknown,
    set: ShowdownSet,
  ): string | null;
  allSources(species: DexSpecies): unknown;
}

/** Species tags that never belong to the roster, whatever the validator says. */
const EXCLUDED_NONSTANDARD = new Set(['CAP', 'Custom', 'LGPE', 'Pokestar', 'Future']);

let validator: Validator | undefined;
export function casualValidator(): Validator {
  validator ??= TeamValidator.get(SHOWDOWN_FORMATS.validator);
  return validator;
}

function internals(): ValidatorInternals {
  return casualValidator() as unknown as ValidatorInternals;
}

/** Minimal set for probing the validator about one species or item. */
function probeSet(species: DexSpecies, item = ''): ShowdownSet {
  return {
    name: species.name,
    species: species.name,
    item,
    ability: Object.values(species.abilities)[0] ?? '',
    moves: [],
    nature: 'Serious',
    gender: '',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: 50,
  } as ShowdownSet;
}

let species: DexSpecies[] | undefined;
/**
 * Species a player can pick (1234 in pokemon-showdown 0.11.11): everything the validator accepts,
 * minus formes that only exist in battle (Megas, Primals, Gigantamax, Aegislash-Blade…).
 */
export function legalSpecies(): DexSpecies[] {
  if (species) return species;
  const v = internals();
  species = getChampionsDex()
    .species.all()
    .filter((s) => {
      if (!s.exists || s.battleOnly || s.isMega || s.isPrimal || s.forme === 'Gmax') return false;
      if (s.isNonstandard && EXCLUDED_NONSTANDARD.has(s.isNonstandard)) return false;
      const set = probeSet(s);
      if (v.checkSpecies(set, s, s, {})) return false;
      const problems = v.format.onValidateSet?.call(casualValidator(), set, v.format, {}, {});
      return !problems || problems.length === 0;
    });
  return species;
}

interface MovePoolDex {
  species: { getMovePool(id: string, natDex: boolean): Set<string> };
}

/**
 * Ids of the moves `forme` can legally know. Candidates = its Champions movepool plus its Gen 9
 * National Dex movepool (the Champions mod replaces the learnsets of its roster), then each one
 * is confirmed by the validator.
 */
export function learnableMoves(forme: DexSpecies): string[] {
  const dex = getChampionsDex();
  const v = internals();
  const pool = new Set([
    ...(dex as unknown as MovePoolDex).species.getMovePool(forme.id, true),
    ...(Dex.mod('gen9') as unknown as MovePoolDex).species.getMovePool(forme.id, true),
  ]);
  const set = probeSet(forme);
  const sources = v.allSources(forme);
  return [...pool].filter((id) => {
    const move = dex.moves.get(id);
    if (!move.exists || move.isZ || move.isMax) return false;
    const problem = v.format.checkCanLearn
      ? v.format.checkCanLearn.call(casualValidator(), move, forme, sources, set)
      : v.checkCanLearn(move, forme, sources, set);
    return problem === null;
  });
}

/**
 * Items worth holding that the ruleset allows: no Poké Balls, no Z-Crystals (Z-Move Clause),
 * nothing the validator rejects (probed on a species that may hold it).
 */
export function legalItems(): DexItemEntry[] {
  const dex = getChampionsDex();
  const validatorInstance = casualValidator();
  return dex.items.all().filter((item) => {
    if (!item.exists || item.isPokeball || item.zMove) return false;
    if (item.isNonstandard && EXCLUDED_NONSTANDARD.has(item.isNonstandard)) return false;
    if (/^TR\d+$/.test(item.name)) return false;
    // `megaStone` maps the base species to its Mega forme.
    const holderName = Object.keys(item.megaStone ?? {})[0] ?? item.itemUser?.[0] ?? 'Mew';
    const holder = dex.species.get(holderName);
    const set = probeSet(holder.exists ? holder : dex.species.get('Mew'), item.name);
    const problems = validatorInstance.validateSet(set, {}) ?? [];
    return !problems.some((problem) => problem.includes(item.name));
  });
}
