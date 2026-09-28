import type { EffectDuration } from '@poke-air/shared';
import { getChampionsDex } from './showdown.js';

/** The slice of a condition we read: its base duration and the callback that may extend it. */
interface TimedCondition {
  exists: boolean;
  duration?: number;
  durationCallback?: (this: unknown, ...args: unknown[]) => number;
}

/**
 * Stand-in for the Pokémon/battle a `durationCallback` receives. Showdown's callbacks only ask
 * whether the setter holds the extending item (Light Clay, Heat Rock, Terrain Extender…) or has an
 * ability like Persistent; `holdsItems` answers the item question for every item.
 */
function probe(holdsItems: boolean) {
  const holder = { hasItem: () => holdsItems, hasAbility: () => false };
  const battle = { add: () => {}, effectState: {} };
  return { holder, battle };
}

function callDuration(condition: TimedCondition, holdsItems: boolean): number | undefined {
  if (!condition.durationCallback) return condition.duration;
  const { holder, battle } = probe(holdsItems);
  try {
    // Weather/terrain callbacks take (source, effect); side conditions take (target, source, effect).
    const turns = condition.durationCallback.call(battle, holder, holder, holder);
    return typeof turns === 'number' ? turns : condition.duration;
  } catch {
    return condition.duration;
  }
}

const cache = new Map<string, EffectDuration | null>();

/**
 * How many turns a weather / terrain / pseudo-weather / side condition lasts, from the dex
 * (decision D-34): `min` without items, `max` with the extending item. `undefined` for effects
 * without a duration (entry hazards, primal weathers).
 */
export function effectDuration(name: string): EffectDuration | undefined {
  const cached = cache.get(name);
  if (cached !== undefined) return cached ?? undefined;

  const condition = getChampionsDex().conditions.get(name) as unknown as TimedCondition;
  let result: EffectDuration | null = null;
  if (condition.exists) {
    const min = callDuration(condition, false);
    const max = callDuration(condition, true);
    if (min && min > 0) result = { min, max: Math.max(min, max ?? min) };
  }
  cache.set(name, result);
  return result ?? undefined;
}

/** "move: Reflect" / "Reflect" → "Reflect" (the name the Host shows, see its model). */
function effectName(value: string | undefined): string {
  return (value ?? '').replace(/^(move|ability|item): /, '').trim();
}

/** Durations of the timed effects started in these spectator lines, by the name the Host uses. */
export function effectsIn(lines: readonly string[]): Record<string, EffectDuration> {
  const effects: Record<string, EffectDuration> = {};
  for (const line of lines) {
    const [, command, a1, a2] = line.split('|');
    let name = '';
    if (command === '-weather' && a1 && a1 !== 'none') name = a1;
    else if (command === '-fieldstart') name = effectName(a1);
    else if (command === '-sidestart') name = effectName(a2);
    if (!name || effects[name]) continue;
    const duration = effectDuration(name);
    if (duration) effects[name] = duration;
  }
  return effects;
}
