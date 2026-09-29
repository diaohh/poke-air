import { Protocol } from '@pkmn/protocol';
import type { BoostId, EffectDuration, SideId, StatusId } from '@poke-air/shared';

/**
 * HostBattleModel: a pure reducer over the public spectator log (decision D-18). Each protocol
 * line updates the displayed state and may yield one `SceneEvent` that the playback animates and
 * narrates. Unknown lines are ignored. No dex data: everything comes from the lines themselves.
 */

export type { BoostId };

/**
 * A weather, terrain, field or side effect on the field. `since` is the first turn it counts for:
 * effects set before turn 1 or after the turn's residuals (`|upkeep|`) start counting next turn.
 * `layers` counts repeated `-sidestart` lines (Spikes ×3, Toxic Spikes ×2).
 */
export interface FieldEffect {
  name: string;
  since: number;
  layers: number;
}

export interface ScenePokemon {
  /** Nickname (random sets use the species name). Unique per side (Species Clause). */
  name: string;
  /** Current species/forme, e.g. "Garchomp-Mega" (drives the sprite). */
  species: string;
  level: number;
  gender?: string;
  shiny: boolean;
  /** Public HP as a percentage (0–100). */
  hp: number;
  status?: StatusId;
  fainted: boolean;
  boosts: Partial<Record<BoostId, number>>;
  mega: boolean;
  /** Behind a Substitute: the scene shows the doll instead of the sprite. */
  substitute: boolean;
}

export interface SceneSide {
  id: SideId;
  name: string;
  teamSize: number;
  /**
   * Name of the Pokémon in each position (index 0 = `p1a`, 1 = `p1b` in doubles): `null` before
   * the first switch-in; a fainted Pokémon stays until its replacement arrives.
   */
  active: (string | null)[];
  /** Pokémon revealed so far, in order of appearance. */
  pokemon: ScenePokemon[];
  /** Side conditions: Reflect, Stealth Rock, Tailwind… */
  conditions: FieldEffect[];
}

export interface SceneState {
  /** Positions per side: 1 singles, 2 doubles (`|gametype|`). */
  activePerSide: number;
  sides: Record<SideId, SceneSide>;
  /** Weather as the protocol names it ("RainDance", "Snowscape"…). */
  weather: FieldEffect | null;
  terrain: FieldEffect | null;
  /** Field-wide effects other than terrain: Trick Room, Gravity… */
  field: FieldEffect[];
  turn: number;
  /** The current turn's end-of-turn effects already ran (`|upkeep|`). */
  upkeep: boolean;
  ended: boolean;
  /** Winner side name, `null` = tie (only meaningful when `ended`). */
  winner: string | null;
}

/** Narration line: an i18n key under `battle.log` + interpolation params. */
export interface Narration {
  key: NarrationKey;
  params?: Record<string, string | number>;
}

export type NarrationKey =
  | 'sentOut'
  | 'dragged'
  | 'swapped'
  | 'used'
  | 'superEffective'
  | 'resisted'
  | 'immune'
  | 'crit'
  | 'missed'
  | 'failed'
  | 'fainted'
  | 'megaEvolved'
  | 'status.brn'
  | 'status.par'
  | 'status.psn'
  | 'status.tox'
  | 'status.slp'
  | 'status.frz'
  | 'cured'
  | 'boost.1'
  | 'boost.2'
  | 'boost.3'
  | 'unboost.1'
  | 'unboost.2'
  | 'unboost.3'
  | 'hurtBy'
  | 'hurtByStatus.brn'
  | 'hurtByStatus.psn'
  | 'restoredBy'
  | 'healed'
  | 'cant'
  | 'protected'
  | 'ability'
  | 'confused'
  | 'substitute'
  | 'substituteHit'
  | 'substituteEnd'
  | 'itemEaten'
  | 'itemLost'
  | 'itemUsed'
  | 'itemRevealed'
  | 'itemObtained'
  | 'weatherStart'
  | `weather.${WeatherId}`
  | 'weatherEnd'
  | 'fieldStart'
  | 'fieldEnd'
  | 'sideStart'
  | 'sideEnd'
  | 'won'
  | 'tie';

export type SceneEventKind =
  | 'switch'
  | 'move'
  | 'damage'
  | 'heal'
  | 'faint'
  | 'mega'
  | 'status'
  | 'boost'
  | 'unboost'
  | 'effect'
  | 'message'
  | 'turn'
  | 'end';

export interface SceneEvent {
  kind: SceneEventKind;
  /** Side the event happens to (attacker for `move`). */
  side?: SideId;
  /** Position on that side (doubles: 0 = left `a`, 1 = right `b`). */
  position?: number;
  /** `move`: the move name (type/category come from the log's move metadata). */
  move?: string;
  /** `move`: the side being targeted. */
  target?: SideId;
  /** `move`: the targeted position (the first target of a spread move). */
  targetPosition?: number;
  /** `boost` / `unboost`: the stat and the stage change (signed), for the floating badge. */
  boost?: { stat: BoostId; amount: number };
  narration?: Narration;
}

export interface SceneStep {
  state: SceneState;
  event: SceneEvent | null;
}

/** Weathers with their own narration line; others use the generic `weatherStart`. */
export const WEATHERS = [
  'SunnyDay',
  'RainDance',
  'Sandstorm',
  'Snow',
  'Hail',
  'DesolateLand',
  'PrimordialSea',
  'DeltaStream',
] as const;
export type WeatherId = (typeof WEATHERS)[number];
const WEATHER_ALIASES: Record<string, WeatherId> = { Snowscape: 'Snow' };

/** "Snowscape" → "Snow"; `null` for weathers without their own texts. */
export function weatherId(weather: string): WeatherId | null {
  const id = WEATHER_ALIASES[weather] ?? weather;
  return (WEATHERS as readonly string[]).includes(id) ? (id as WeatherId) : null;
}

function weatherKey(weather: string): NarrationKey | null {
  const id = weatherId(weather);
  return id ? `weather.${id}` : null;
}

export function initialScene(): SceneState {
  const side = (id: SideId): SceneSide => ({
    id,
    name: '',
    teamSize: 0,
    active: [null],
    pokemon: [],
    conditions: [],
  });
  return {
    activePerSide: 1,
    sides: { p1: side('p1'), p2: side('p2') },
    weather: null,
    terrain: null,
    field: [],
    turn: 0,
    upkeep: false,
    ended: false,
    winner: null,
  };
}

/** Applies a whole log at once (Host resync) — no events. */
export function sceneFromLog(lines: readonly string[]): SceneState {
  return lines.reduce((state, line) => applyLine(state, line).state, initialScene());
}

/** A new effect starting now (see `FieldEffect.since`). */
function startEffect(state: SceneState, name: string): FieldEffect {
  return { name, since: state.upkeep || state.turn === 0 ? state.turn + 1 : state.turn, layers: 1 };
}

/**
 * Turns an effect has left (the current one included) out of its total duration, e.g. Rain 1 of 4.
 * The total is the dex's base duration; if the effect outlives it, an item the spectators can't
 * see (Light Clay, weather rocks…) extended it, so the extended duration becomes the total.
 * `null` when unknown (no duration, e.g. hazards).
 */
export function turnsLeft(
  effect: FieldEffect,
  state: Pick<SceneState, 'turn' | 'upkeep'>,
  duration: EffectDuration | undefined,
): { left: number; total: number } | null {
  if (!duration) return null;
  const elapsed = Math.max(0, state.turn - effect.since + (state.upkeep ? 1 : 0));
  if (duration.min - elapsed > 0) return { left: duration.min - elapsed, total: duration.min };
  if (duration.max - elapsed > 0) return { left: duration.max - elapsed, total: duration.max };
  return null;
}

/** The Pokémon in a position (the first one by default: singles). */
export function activePokemon(
  state: SceneState,
  side: SideId,
  position = 0,
): ScenePokemon | undefined {
  const { active, pokemon } = state.sides[side];
  const name = active[position];
  return name ? pokemon.find((p) => p.name === name) : undefined;
}

type Args = readonly string[];
type KwArgs = Record<string, string | true | undefined>;

/**
 * "p1a: Garchomp" → { side: 'p1', position: 0, name: 'Garchomp' }. Idents without a position
 * (e.g. `|-mega|` sometimes, `|detailschange|`) have `position: null`.
 */
function ident(
  value: string | undefined,
): { side: SideId; position: number | null; name: string } | null {
  if (!value || !/^p[12][a-c]?: /.test(value)) return null;
  const { player, position, name } = Protocol.parsePokemonIdent(value as Protocol.PokemonIdent);
  return { side: player as SideId, position: position ? 'abc'.indexOf(position) : null, name };
}

/** Where this Pokémon stands now (by name), when the ident doesn't say. */
function positionOf(state: SceneState, side: SideId, name: string): number | undefined {
  const index = state.sides[side].active.indexOf(name);
  return index >= 0 ? index : undefined;
}

/** "item: Leftovers" / "ability: Rough Skin" / "Stealth Rock" → display name. */
function effectName(value: string | true | undefined): string {
  if (typeof value !== 'string') return '';
  return Protocol.parseEffect(value).name;
}

function boostKey(amount: number, up: boolean): NarrationKey {
  const size = Math.min(3, Math.max(1, Math.abs(amount)));
  return `${up ? 'boost' : 'unboost'}.${size}` as NarrationKey;
}

/** Applies one protocol line. Never throws: malformed lines leave the state unchanged. */
export function applyLine(previous: SceneState, line: string): SceneStep {
  if (!line.startsWith('|') || line === '|') return { state: previous, event: null };
  let parsed: { args: Args; kwArgs: KwArgs };
  try {
    parsed = Protocol.parseBattleLine(line) as unknown as { args: Args; kwArgs: KwArgs };
  } catch {
    return { state: previous, event: null };
  }
  const { args, kwArgs } = parsed;
  const state = structuredClone(previous);
  const event = reduce(state, args, kwArgs);
  return { state, event };
}

/** Reduces one line, then tags the event with the position of the Pokémon it happens to. */
function reduce(state: SceneState, args: Args, kwArgs: KwArgs): SceneEvent | null {
  const event = reduceLine(state, args, kwArgs);
  if (event?.side && event.position === undefined) {
    const who = ident(args[1]);
    const position = who && (who.position ?? positionOf(state, who.side, who.name));
    if (who?.side === event.side && typeof position === 'number') event.position = position;
  }
  return event;
}

/** One flat switch over the protocol commands we render (docs/11-phase-1-plan.md WP5). */
function reduceLine(state: SceneState, args: Args, kwArgs: KwArgs): SceneEvent | null {
  const [command = '', a1, a2, a3] = args;
  const who = ident(a1);
  const mon = who ? findPokemon(state, who.side, who.name) : undefined;
  const pokemon = mon?.name ?? who?.name ?? '';

  switch (command) {
    case 'gametype': {
      const positions = a1 === 'doubles' ? 2 : a1 === 'triples' ? 3 : 1;
      state.activePerSide = positions;
      for (const side of Object.values(state.sides)) {
        side.active = Array.from({ length: positions }, (_, i) => side.active[i] ?? null);
      }
      return null;
    }
    case 'player': {
      if (a1 === 'p1' || a1 === 'p2') {
        if (a2) state.sides[a1].name = a2;
      }
      return null;
    }
    case 'teamsize': {
      if (a1 === 'p1' || a1 === 'p2') state.sides[a1].teamSize = Number(a2) || 0;
      return null;
    }
    case 'turn': {
      state.turn = Number(a1) || state.turn;
      state.upkeep = false;
      return { kind: 'turn' };
    }
    case 'upkeep': {
      state.upkeep = true;
      return null;
    }
    case 'switch':
    case 'drag':
    case 'replace': {
      if (!who || !a2) return null;
      const side = state.sides[who.side];
      const position = who.position ?? 0;
      while (side.active.length <= position) side.active.push(null);
      const next = upsertPokemon(state, who.side, who.name, a2);
      if (a3) applyHealth(next, a3);
      if (command !== 'replace') {
        const leavingName = side.active[position];
        const leaving = leavingName ? findPokemon(state, who.side, leavingName) : undefined;
        if (leaving && leaving !== next) {
          leaving.boosts = {};
          leaving.substitute = false;
        }
        next.boosts = {};
        next.substitute = false;
      }
      side.active[position] = next.name;
      if (command === 'replace') return null;
      return {
        kind: 'switch',
        side: who.side,
        narration:
          command === 'drag'
            ? { key: 'dragged', params: { pokemon: next.name } }
            : { key: 'sentOut', params: { trainer: side.name, pokemon: next.name } },
      };
    }
    case 'detailschange':
    case '-formechange': {
      if (!mon || !a2) return null;
      mon.species = a2.split(', ')[0] ?? mon.species;
      return null;
    }
    case '-mega': {
      if (!mon || !who) return null;
      mon.mega = true;
      return {
        kind: 'mega',
        side: who.side,
        narration: { key: 'megaEvolved', params: { pokemon } },
      };
    }
    case 'move': {
      if (!who || !a2) return null;
      const target = ident(a3);
      const targetPosition = target
        ? (target.position ?? positionOf(state, target.side, target.name))
        : undefined;
      return {
        kind: 'move',
        side: who.side,
        move: a2,
        target: target?.side ?? (who.side === 'p1' ? 'p2' : 'p1'),
        ...(targetPosition === undefined ? {} : { targetPosition }),
        narration: { key: 'used', params: { pokemon, move: a2 } },
      };
    }
    case 'swap': {
      // Ally Switch: `|swap|p1a: X|1` moves X to position 1, the Pokémon there takes its place.
      if (!who || a2 === undefined) return null;
      const side = state.sides[who.side];
      const from = who.position ?? positionOf(state, who.side, who.name);
      const to = Number(a2);
      if (from === undefined || !Number.isInteger(to) || from === to) return null;
      while (side.active.length <= Math.max(from, to)) side.active.push(null);
      const moving = side.active[from] ?? null;
      side.active[from] = side.active[to] ?? null;
      side.active[to] = moving;
      return {
        kind: 'effect',
        side: who.side,
        position: to,
        narration: { key: 'swapped', params: { pokemon } },
      };
    }
    case '-damage':
    case '-heal':
    case '-sethp': {
      if (!mon || !who || !a2) return null;
      const before = mon.hp;
      applyHealth(mon, a2);
      const from = effectName(kwArgs.from);
      if (command === '-sethp')
        return { kind: mon.hp < before ? 'damage' : 'heal', side: who.side };
      if (command === '-damage') {
        if (!from) return { kind: 'damage', side: who.side };
        const status = from === 'brn' ? 'brn' : from === 'psn' || from === 'tox' ? 'psn' : null;
        return {
          kind: 'damage',
          side: who.side,
          narration: status
            ? { key: `hurtByStatus.${status}`, params: { pokemon } }
            : { key: 'hurtBy', params: { pokemon, effect: from } },
        };
      }
      return {
        kind: 'heal',
        side: who.side,
        narration: from
          ? { key: 'restoredBy', params: { pokemon, effect: from } }
          : { key: 'healed', params: { pokemon } },
      };
    }
    case 'faint': {
      if (!mon || !who) return null;
      // Stays `active` (shown at 0 HP, faded out) until the replacement switches in.
      mon.hp = 0;
      mon.fainted = true;
      mon.status = undefined;
      mon.substitute = false;
      return { kind: 'faint', side: who.side, narration: { key: 'fainted', params: { pokemon } } };
    }
    case '-status': {
      if (!mon || !who || !a2) return null;
      mon.status = a2 as StatusId;
      return {
        kind: 'status',
        side: who.side,
        narration: { key: `status.${a2}` as NarrationKey, params: { pokemon } },
      };
    }
    case '-curestatus': {
      if (!mon || !who) return null;
      mon.status = undefined;
      return { kind: 'effect', side: who.side, narration: { key: 'cured', params: { pokemon } } };
    }
    case '-cureteam': {
      if (!who) return null;
      for (const p of state.sides[who.side].pokemon) p.status = undefined;
      return null;
    }
    case '-boost':
    case '-unboost': {
      if (!mon || !who || !a2) return null;
      const up = command === '-boost';
      const amount = Number(a3) || 0;
      const stat = a2 as BoostId;
      mon.boosts[stat] = clampBoost((mon.boosts[stat] ?? 0) + (up ? amount : -amount));
      if (amount === 0) return null;
      return {
        kind: up ? 'boost' : 'unboost',
        side: who.side,
        boost: { stat, amount: up ? amount : -amount },
        narration: { key: boostKey(amount, up), params: { pokemon, stat } },
      };
    }
    case '-setboost': {
      if (mon && a2) mon.boosts[a2 as BoostId] = clampBoost(Number(a3) || 0);
      return null;
    }
    case '-clearboost':
    case '-clearnegativeboost': {
      if (!mon) return null;
      if (command === '-clearboost') mon.boosts = {};
      else
        for (const key of Object.keys(mon.boosts) as BoostId[]) {
          if ((mon.boosts[key] ?? 0) < 0) delete mon.boosts[key];
        }
      return null;
    }
    case '-clearallboost': {
      for (const side of Object.values(state.sides)) for (const p of side.pokemon) p.boosts = {};
      return null;
    }
    case '-transform': {
      const target = ident(a2);
      const source = target && findPokemon(state, target.side, target.name);
      if (mon && source) mon.species = source.species;
      return null;
    }
    case '-supereffective':
      return { kind: 'message', narration: { key: 'superEffective' } };
    case '-resisted':
      return { kind: 'message', narration: { key: 'resisted' } };
    case '-crit':
      return { kind: 'message', narration: { key: 'crit' } };
    case '-immune':
      return { kind: 'message', narration: { key: 'immune', params: { pokemon } } };
    case '-miss': {
      const target = ident(a2);
      const targetMon = target && findPokemon(state, target.side, target.name);
      const name = targetMon?.name ?? target?.name ?? pokemon;
      return { kind: 'message', narration: { key: 'missed', params: { pokemon: name } } };
    }
    case '-fail':
    case '-notarget':
      return { kind: 'message', narration: { key: 'failed' } };
    case 'cant':
      return { kind: 'message', narration: { key: 'cant', params: { pokemon } } };
    case '-block': {
      // `@pkmn/protocol` turns `-activate|<mon>|move: Protect` (and Detect, Wide Guard, Max Guard…)
      // into `-block`: the attack hit a protection.
      if (!who) return null;
      return {
        kind: 'effect',
        side: who.side,
        narration: { key: 'protected', params: { pokemon } },
      };
    }
    case '-activate': {
      const effect = effectName(a2);
      // A hit absorbed by a Substitute that holds (`[damage]`): the doll flinches, HP untouched.
      // Without `[damage]` the doll blocked a status move (`[block]`).
      if (who && effect === 'Substitute') {
        return kwArgs.damage
          ? {
              kind: 'damage',
              side: who.side,
              narration: { key: 'substituteHit', params: { pokemon } },
            }
          : { kind: 'message', narration: { key: 'failed' } };
      }
      // Abilities announced through `-activate` (e.g. Synchronize, Cursed Body) get the ability call-out.
      if (who && typeof a2 === 'string' && a2.startsWith('ability: ')) {
        return {
          kind: 'effect',
          side: who.side,
          narration: { key: 'ability', params: { pokemon, ability: effect } },
        };
      }
      if (
        !who ||
        !/^(Protect|Detect|Max Guard|King's Shield|Spiky Shield|Baneful Bunker|Silk Trap|Burning Bulwark)$/.test(
          effect,
        )
      ) {
        return null;
      }
      return {
        kind: 'effect',
        side: who.side,
        narration: { key: 'protected', params: { pokemon } },
      };
    }
    case '-enditem': {
      // Berries eaten, Focus Sash / Air Balloon / Weakness Policy used up, items knocked off…
      if (!who || !a2) return null;
      const item = effectName(a2);
      const from = typeof kwArgs.from === 'string' ? kwArgs.from : '';
      const key: NarrationKey = kwArgs.eat
        ? 'itemEaten'
        : from.startsWith('move:') || kwArgs.stealeat
          ? 'itemLost'
          : 'itemUsed';
      return { kind: 'effect', side: who.side, narration: { key, params: { pokemon, item } } };
    }
    case '-item': {
      // Revealed (Frisk, Air Balloon on switch-in) or received (Trick, Switcheroo, Thief).
      if (!who || !a2) return null;
      const from = typeof kwArgs.from === 'string' ? kwArgs.from : '';
      return {
        kind: 'effect',
        side: who.side,
        narration: {
          key: from.startsWith('move:') ? 'itemObtained' : 'itemRevealed',
          params: { pokemon, item: effectName(a2) },
        },
      };
    }
    case '-ability': {
      if (!who || !a2 || kwArgs.silent) return null;
      return {
        kind: 'effect',
        side: who.side,
        narration: { key: 'ability', params: { pokemon, ability: a2 } },
      };
    }
    case '-start': {
      const effect = effectName(a2);
      if (mon && who && effect === 'Substitute') {
        mon.substitute = true;
        return {
          kind: 'effect',
          side: who.side,
          narration: { key: 'substitute', params: { pokemon } },
        };
      }
      if (!who || effect !== 'confusion') return null;
      return {
        kind: 'effect',
        side: who.side,
        narration: { key: 'confused', params: { pokemon } },
      };
    }
    case '-end': {
      // Only the Substitute ending is shown (it broke or faded); other volatiles end silently.
      if (!mon || !who || effectName(a2) !== 'Substitute') return null;
      mon.substitute = false;
      return {
        kind: 'effect',
        side: who.side,
        narration: { key: 'substituteEnd', params: { pokemon } },
      };
    }
    case '-weather': {
      if (!a1) return null;
      if (a1 === 'none') {
        const ended = state.weather;
        state.weather = null;
        return ended ? { kind: 'message', narration: { key: 'weatherEnd' } } : null;
      }
      if (state.weather?.name === a1) return null;
      state.weather = startEffect(state, a1);
      if (kwArgs.upkeep) return null;
      const key = weatherKey(a1);
      return {
        kind: 'message',
        narration: key ? { key } : { key: 'weatherStart', params: { weather: a1 } },
      };
    }
    case '-fieldstart':
    case '-fieldend': {
      const effect = effectName(a1);
      if (!effect) return null;
      const terrain = /Terrain$/.test(effect);
      if (command === '-fieldstart') {
        if (terrain) state.terrain = startEffect(state, effect);
        else if (!state.field.some((f) => f.name === effect)) {
          state.field.push(startEffect(state, effect));
        }
      } else if (terrain) state.terrain = null;
      else state.field = state.field.filter((f) => f.name !== effect);
      return {
        kind: 'message',
        narration: {
          key: command === '-fieldstart' ? 'fieldStart' : 'fieldEnd',
          params: { effect },
        },
      };
    }
    case '-sidestart':
    case '-sideend': {
      const sideId = a1?.slice(0, 2);
      if (sideId !== 'p1' && sideId !== 'p2') return null;
      const side = state.sides[sideId];
      const effect = effectName(a2);
      if (command === '-sidestart') {
        const existing = side.conditions.find((c) => c.name === effect);
        if (existing) existing.layers++;
        else side.conditions.push(startEffect(state, effect));
      } else side.conditions = side.conditions.filter((c) => c.name !== effect);
      return {
        kind: 'message',
        narration: {
          key: command === '-sidestart' ? 'sideStart' : 'sideEnd',
          params: { effect, trainer: side.name },
        },
      };
    }
    case 'win': {
      state.ended = true;
      state.winner = a1 ?? null;
      return { kind: 'end', narration: { key: 'won', params: { name: a1 ?? '' } } };
    }
    case 'tie': {
      state.ended = true;
      state.winner = null;
      return { kind: 'end', narration: { key: 'tie' } };
    }
    default:
      return null;
  }
}

function findPokemon(state: SceneState, side: SideId, name: string): ScenePokemon | undefined {
  return state.sides[side].pokemon.find((p) => p.name === name);
}

function upsertPokemon(state: SceneState, side: SideId, name: string, details: string) {
  const parsed = Protocol.parseDetails(
    name,
    `${side}: ${name}` as Protocol.PokemonIdent,
    details as Protocol.PokemonDetails,
  );
  let pokemon = findPokemon(state, side, name);
  if (!pokemon) {
    pokemon = {
      name,
      species: parsed.speciesForme,
      level: parsed.level,
      shiny: false,
      hp: 100,
      fainted: false,
      boosts: {},
      mega: false,
      substitute: false,
    };
    state.sides[side].pokemon.push(pokemon);
  }
  pokemon.species = parsed.speciesForme;
  pokemon.level = parsed.level;
  pokemon.shiny = parsed.shiny;
  if (parsed.gender) pokemon.gender = parsed.gender;
  return pokemon;
}

/** "66/100y" · "0 fnt" · "40/100 par" */
function applyHealth(pokemon: ScenePokemon, value: string): void {
  const health = Protocol.parseHealth(value as Protocol.PokemonHPStatus);
  if (!health) return;
  pokemon.hp = health.maxhp ? Math.round((health.hp / health.maxhp) * 100) : 0;
  if (health.fainted) {
    pokemon.hp = 0;
    pokemon.fainted = true;
  }
  // No status in the string doesn't mean "cured": that arrives as its own `-curestatus` line.
  if (health.status) pokemon.status = health.status as StatusId;
}

function clampBoost(value: number): number {
  return Math.max(-6, Math.min(6, value));
}
