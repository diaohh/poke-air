import type { SideId, TeamId } from './constants.js';
import type { StatId, StatTable } from './team.js';

/**
 * Battle payloads. Hand-written subset of the Showdown request/protocol shapes recorded in
 * docs/05-game-rules-and-mechanics.md ("Verified simulator facts"); `core` maps the sim's objects to
 * these types and enriches moves with dex metadata (decision D-22), so phones need no dex data.
 */

export type MoveCategory = 'Physical' | 'Special' | 'Status';
export type StatusId = 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz';

/** Public metadata of a move (also sent to the Host for moves that appear in the log). */
export interface MoveMeta {
  type: string;
  category: MoveCategory;
}

export interface BattleMoveOption extends MoveMeta {
  /** Showdown move id, e.g. "earthquake" (key for future localization). */
  id: string;
  name: string;
  basePower: number;
  /** `true` = never misses. */
  accuracy: number | true;
  pp: number;
  maxpp: number;
  /** Showdown target, e.g. "normal", "self", "allAdjacentFoes". */
  target: string;
  disabled: boolean;
  /** English short description from the dex (localized by id in Phase 4). */
  description: string;
}

/** One active position this player decides in a `move` request. */
export interface BattleActiveOption {
  /** Side position: 0 = left (`p1a`), 1 = right (`p1b`, doubles). */
  position: number;
  /** Name of the Pokémon in that position. */
  pokemon: string;
  moves: BattleMoveOption[];
  /** This Pokémon can Mega Evolve and the player still has a Mega Evolution left. */
  canMegaEvo: boolean;
  /** Can't switch out. */
  trapped: boolean;
}

/** One position this player must fill in a `switch` request. */
export interface BattleSwitchSlot {
  position: number;
  /** Name of the Pokémon leaving it (fainted, or switched out by U-turn / Eject Button…). */
  pokemon: string;
}

/** Public view of one active position (what the TV shows): used to pick targets. */
export interface BattleFieldSlot {
  name: string;
  species: string;
  /** Public HP percentage (0–100). */
  hp: number;
  fainted: boolean;
}

/** Every active position by side, indexed by position (`null` = empty). */
export interface BattleField {
  own: (BattleFieldSlot | null)[];
  foe: (BattleFieldSlot | null)[];
}

/**
 * Move targets that need a chosen target when there is more than one position per side
 * (Showdown's `targetTypeChoices`). Spread, self and field moves never ask.
 */
export const CHOSEN_TARGETS = [
  'normal',
  'any',
  'adjacentFoe',
  'adjacentAlly',
  'adjacentAllyOrSelf',
] as const;

export interface TargetOption {
  /** Value for `move N <target>`: foe positions 1, 2; own positions -1, -2. */
  loc: number;
  side: 'own' | 'foe';
  position: number;
}

/**
 * Where a move used from `position` can be aimed (doubles: every position is adjacent). Empty when
 * the move needs no target. Fainted / empty positions are included: the sim retargets.
 */
export function targetOptions(
  target: string,
  position: number,
  activePerSide: number,
): TargetOption[] {
  const options: TargetOption[] = [];
  if (activePerSide < 2 || !(CHOSEN_TARGETS as readonly string[]).includes(target)) return options;
  const foes = target !== 'adjacentAlly' && target !== 'adjacentAllyOrSelf';
  const allies = target !== 'adjacentFoe';
  for (let i = 0; i < activePerSide; i++) {
    if (foes) options.push({ loc: i + 1, side: 'foe', position: i });
  }
  for (let i = 0; i < activePerSide; i++) {
    const self = i === position;
    if (allies && (!self || target === 'adjacentAllyOrSelf')) {
      options.push({ loc: -(i + 1), side: 'own', position: i });
    }
  }
  return options;
}

export interface BattlePokemonMove {
  id: string;
  name: string;
  type: string;
}

/** What a stat stage (`-boost`) can change: the five computed stats plus accuracy and evasion. */
export type BoostId = Exclude<StatId, 'hp'> | 'accuracy' | 'evasion';

/** A nature and the stats it raises / lowers (both absent for neutral natures). */
export interface NatureInfo {
  name: string;
  plus?: StatId;
  minus?: StatId;
}

/** One of the player's own Pokémon, with exact HP (private data). */
export interface BattlePokemon {
  /** e.g. "p1: Garchomp". */
  ident: string;
  name: string;
  /** Current species/forme, e.g. "Garchomp-Mega". */
  species: string;
  level: number;
  gender?: string;
  shiny?: boolean;
  hp: number;
  maxhp: number;
  status?: StatusId;
  fainted: boolean;
  active: boolean;
  /** `switch N` value: 1-based index in the side's current order (it changes as Pokémon switch). */
  slot: number;
  /** Side position when active (0 = left, 1 = right). */
  position?: number;
  item: string;
  /** Item icon sheet index (`ITEM_ICON_SHEET`), when holding an item. */
  itemIcon?: number;
  ability: string;
  moves: BattlePokemonMove[];
  /** Computed stats (Lv 50, nature and Stat Points applied); `hp` = max HP. */
  stats: StatTable;
  /** From the owner's own set (the sim request has no nature). */
  nature?: NatureInfo;
  /** Stat Points invested per stat, from the owner's own set (where the build is focused). */
  statPoints?: StatTable;
  /** Current stat stages (active Pokémon only; only non-zero entries). */
  boosts?: Partial<Record<BoostId, number>>;
}

/**
 * What one phone has to decide (the OwnershipLayer's share of its side's request, decision D-43):
 * - `move`: a move or a switch for each position in `active` (the player's own active Pokémon),
 * - `switch`: a Pokémon for each position in `forceSwitch` (after a faint / U-turn),
 * - `wait`: nothing to do now (the opponent or the teammate is choosing).
 *
 * The phone answers with one action per entry, in order, comma-separated:
 * `move 1 2 mega, switch 4` (`move N [target] [mega]` · `switch <slot>`).
 */
export interface BattleRequest {
  kind: 'move' | 'switch' | 'wait';
  /** Showdown request id; echoed back in `battle:choose` to reject stale taps. */
  rqid: number;
  side: SideId;
  /** Positions per side: 1 in singles, 2 in doubles. */
  activePerSide: number;
  active: BattleActiveOption[];
  forceSwitch: BattleSwitchSlot[];
  /** Only this player's own Pokémon (never a teammate's), in the side's current order. */
  pokemon: BattlePokemon[];
  /** Public view of the field when the request was made (targets, ally line). */
  field: BattleField;
  /** Mega Evolutions this player has left (1 per player; 2 for the solo player of a 1v2). */
  megasLeft: number;
  /** A teammate's chosen action Mega Evolves this turn (one per team per turn). */
  allyMega: boolean;
}

/**
 * `battle:request` payload. `request: null` means "a new turn is resolving: watch the big screen";
 * `choice` is this player's choice already sent for this request (to rebuild the waiting view after
 * a refresh).
 */
export interface BattleRequestPayload {
  request: BattleRequest | null;
  choice: string | null;
}

/** `battle:waiting` payload (Host + phones). */
export interface BattleWaiting {
  /** Players that still have to choose for the current decision. */
  waitingFor: string[];
  /** Remaining turn-timer time when sent (ms), `null` when no timer runs. Clock-skew safe. */
  timerMs: number | null;
}

/**
 * Duration of a field / side effect in turns. `max > min` when an item the spectators can't see may
 * extend it (Light Clay, weather rocks, Terrain Extender).
 */
export interface EffectDuration {
  min: number;
  max: number;
}

/** `battle:log` payload (Host only): public spectator protocol lines, append-only. */
export interface BattleLogPayload {
  /** Index of the first line. `0` replaces the whole log. */
  from: number;
  lines: string[];
  /** Type/category of every move used in `lines` (drives the generic move animations). */
  moves: Record<string, MoveMeta>;
  /** Duration of every timed effect started in `lines` (weather, terrain, screens…), by name. */
  effects: Record<string, EffectDuration>;
  /** True when the Host is catching up (resume): apply without animating. */
  resync?: boolean;
}

export type BattleEndReason = 'normal' | 'forfeit' | 'error';

export interface BattleTeamSummary {
  /** Opposing Pokémon knocked out by this team. */
  kos: number;
  /** Own Pokémon still standing. */
  remaining: number;
  total: number;
}

/** Public result, part of `room:state` while in RESULTS. */
export interface BattleResult {
  winner: TeamId | null;
  reason: BattleEndReason;
  turns: number;
  teams: Record<TeamId, BattleTeamSummary>;
}
