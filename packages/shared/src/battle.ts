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

export interface BattleActiveOption {
  moves: BattleMoveOption[];
  canMegaEvo: boolean;
  /** Can't switch out. */
  trapped: boolean;
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
  item: string;
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
 * The choice a phone has to make:
 * - `move`: pick a move or a switch for the active Pokémon (`active[0]`),
 * - `switch`: forced switch after a faint / U-turn (`forceSwitch[i]` true for slots to fill),
 * - `wait`: nothing to do (the opponent is choosing).
 */
export interface BattleRequest {
  kind: 'move' | 'switch' | 'wait';
  /** Showdown request id; echoed back in `battle:choose` to reject stale taps. */
  rqid: number;
  side: SideId;
  active: BattleActiveOption[];
  forceSwitch: boolean[];
  pokemon: BattlePokemon[];
}

/**
 * `battle:request` payload. `request: null` means "a new turn is resolving: watch the big screen";
 * `choice` is the choice already sent for this request (to rebuild the waiting view after a refresh).
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
