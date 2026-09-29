import type { BattleLogPayload, BattleRequestPayload, BattleWaiting } from './battle.js';
import type { ErrorPayload, Result } from './errors.js';
import type { PublicRoomState } from './room-state.js';
import type {
  BattleChoosePayload,
  BuilderParseTeamPayload,
  BuilderRandomSetPayload,
  BuilderValidateSetPayload,
  EmptyPayload,
  HostAnimatedPayload,
  HostCreateRoomPayload,
  HostKickPayload,
  HostResumeRoomPayload,
  HostSetFormatPayload,
  HostSetLocalePayload,
  PlayerJoinPayload,
  PlayerReadyPayload,
  PlayerSwitchTeamPayload,
  PlayerUpdatePayload,
  TeamImportPayload,
  TeamRandomizePayload,
  TeamSetSlotPayload,
} from './schemas.js';
import type { PokemonSetData, TeamState } from './team.js';

/**
 * Socket.IO event contracts. Naming: `domain:action`.
 * Every client → server event carries a payload object and an acknowledgement callback,
 * so clients can always surface errors (translated from `ErrorPayload.code`).
 */

export type Ack<T = object> = (result: Result<T>) => void;

export interface HostSession {
  code: string;
  hostToken: string;
  room: PublicRoomState;
}

export interface PlayerSession {
  playerId: string;
  reconnectToken: string;
  room: PublicRoomState;
}

/** `team:import` ack: Pokémon placed in the team and Pokémon left out (quota, Species Clause). */
export interface TeamImportResult {
  count: number;
  skipped: number;
}

export type PlayerRemovedReason = 'kicked' | 'replaced' | 'roomClosed';

// ── /host namespace ────────────────────────────────────────────────
export interface HostClientToServerEvents {
  'host:createRoom': (payload: HostCreateRoomPayload, ack: Ack<HostSession>) => void;
  'host:resumeRoom': (payload: HostResumeRoomPayload, ack: Ack<HostSession>) => void;
  'host:setFormat': (payload: HostSetFormatPayload, ack: Ack) => void;
  'host:setLocale': (payload: HostSetLocalePayload, ack: Ack) => void;
  'host:kick': (payload: HostKickPayload, ack: Ack) => void;
  'host:startTeamBuilding': (payload: EmptyPayload, ack: Ack) => void;
  'host:backToLobby': (payload: EmptyPayload, ack: Ack) => void;
  /** Ends the room for everyone (phones get `player:removed: 'roomClosed'`); the Host goes home. */
  'host:closeRoom': (payload: EmptyPayload, ack: Ack) => void;
  /** The Host finished animating the spectator log up to `upTo` lines (releases phone menus). */
  'host:animated': (payload: HostAnimatedPayload, ack: Ack) => void;
  /** RESULTS → TEAM_BUILDING keeping every team. */
  'host:rematch': (payload: EmptyPayload, ack: Ack) => void;
}

export interface HostServerToClientEvents {
  'room:state': (state: PublicRoomState) => void;
  /** Public spectator log, append-only (`from: 0` replaces it: new battle or resume). */
  'battle:log': (payload: BattleLogPayload) => void;
  'battle:waiting': (payload: BattleWaiting) => void;
  error: (error: ErrorPayload) => void;
}

// ── /player namespace ──────────────────────────────────────────────
export interface PlayerClientToServerEvents {
  'player:join': (payload: PlayerJoinPayload, ack: Ack<PlayerSession>) => void;
  'player:update': (payload: PlayerUpdatePayload, ack: Ack) => void;
  'player:switchTeam': (payload: PlayerSwitchTeamPayload, ack: Ack) => void;
  'player:leave': (payload: EmptyPayload, ack: Ack) => void;
  'player:ready': (payload: PlayerReadyPayload, ack: Ack) => void;
  'team:randomize': (payload: TeamRandomizePayload, ack: Ack) => void;
  'team:setSlot': (payload: TeamSetSlotPayload, ack: Ack) => void;
  'team:import': (payload: TeamImportPayload, ack: Ack<TeamImportResult>) => void;
  /** Team builder without a room (D-51): no seat needed. */
  'builder:validateSet': (
    payload: BuilderValidateSetPayload,
    ack: Ack<{ set: PokemonSetData }>,
  ) => void;
  'builder:randomSet': (
    payload: BuilderRandomSetPayload,
    ack: Ack<{ set: PokemonSetData }>,
  ) => void;
  'builder:parseTeam': (
    payload: BuilderParseTeamPayload,
    ack: Ack<{ sets: PokemonSetData[] }>,
  ) => void;
  'battle:choose': (payload: BattleChoosePayload, ack: Ack) => void;
  'battle:undo': (payload: EmptyPayload, ack: Ack) => void;
  'battle:forfeit': (payload: EmptyPayload, ack: Ack) => void;
}

export interface PlayerServerToClientEvents {
  'room:state': (state: PublicRoomState) => void;
  /** Sent right before the server disconnects a kicked player or a replaced session. */
  'player:removed': (reason: PlayerRemovedReason) => void;
  /** Owner only: the player's own team slots. */
  'team:state': (state: TeamState) => void;
  /** Owner only: what this phone has to choose now (`request: null` = watch the big screen). */
  'battle:request': (payload: BattleRequestPayload) => void;
  'battle:waiting': (payload: BattleWaiting) => void;
  error: (error: ErrorPayload) => void;
}
