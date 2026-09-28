import {
  MAX_PLAYERS_PER_ROOM,
  MAX_PLAYERS_PER_TEAM,
  TEAM_IDS,
  type CompositionStatus,
  type GameType,
  type Locale,
  type PublicPlayer,
  type PublicRoomState,
  type RoomPhase,
  type TeamId,
  type TrainerAvatar,
} from '@poke-air/shared';
import { evaluateComposition } from './composition.js';
import { RoomError } from './room-error.js';

export interface PlayerRecord extends PublicPlayer {
  reconnectToken: string;
  joinedAt: number;
}

export interface RoomDeps {
  now: () => number;
  newId: () => string;
}

export interface RoomInit {
  code: string;
  hostToken: string;
  locale: Locale;
}

/**
 * One game room. Pure state + rules, no I/O: the transport layer calls these methods and
 * broadcasts `toPublicState()` after every successful mutation.
 *
 * Phases: LOBBY → TEAM_BUILDING → BATTLE → RESULTS → LOBBY (docs/01-vision-and-game-flow.md).
 */
export class Room {
  readonly code: string;
  readonly hostToken: string;
  phase: RoomPhase = 'LOBBY';
  gameType: GameType = 'singles';
  locale: Locale;
  hostConnected = false;
  lastActivityAt: number;

  private readonly players = new Map<string, PlayerRecord>();
  private readonly deps: RoomDeps;

  constructor(init: RoomInit, deps: RoomDeps) {
    this.code = init.code;
    this.hostToken = init.hostToken;
    this.locale = init.locale;
    this.deps = deps;
    this.lastActivityAt = deps.now();
  }

  // ── Players ──────────────────────────────────────────────────────

  /** New player joining. Only allowed in LOBBY. Auto-assigned to the smaller team (red on ties). */
  addPlayer(input: { name: string; avatar: TrainerAvatar }): PlayerRecord {
    this.assertPhase('LOBBY');
    if (this.players.size >= MAX_PLAYERS_PER_ROOM) throw new RoomError('ROOM_FULL');

    const sizes = this.teamSizes();
    const team: TeamId = sizes.blue < sizes.red ? 'blue' : 'red';
    if (sizes[team] >= MAX_PLAYERS_PER_TEAM) throw new RoomError('ROOM_FULL');

    const player: PlayerRecord = {
      id: this.deps.newId(),
      reconnectToken: this.deps.newId(),
      name: input.name,
      avatar: input.avatar,
      team,
      connected: true,
      joinedAt: this.deps.now(),
    };
    this.players.set(player.id, player);
    this.touch();
    return player;
  }

  /** A phone reclaiming its seat (any phase). */
  rejoinPlayer(playerId: string, reconnectToken: string): PlayerRecord {
    const player = this.players.get(playerId);
    if (!player) throw new RoomError('PLAYER_NOT_FOUND');
    if (player.reconnectToken !== reconnectToken) throw new RoomError('INVALID_RECONNECT_TOKEN');
    player.connected = true;
    this.touch();
    return player;
  }

  updatePlayer(playerId: string, changes: { name?: string; avatar?: TrainerAvatar }): PlayerRecord {
    const player = this.requirePlayer(playerId);
    if (changes.name !== undefined) player.name = changes.name;
    if (changes.avatar !== undefined) player.avatar = changes.avatar;
    this.touch();
    return player;
  }

  switchTeam(playerId: string, team: TeamId): PlayerRecord {
    this.assertPhase('LOBBY');
    const player = this.requirePlayer(playerId);
    if (player.team === team) return player;
    if (this.teamSizes()[team] >= MAX_PLAYERS_PER_TEAM) throw new RoomError('TEAM_FULL');
    player.team = team;
    this.touch();
    return player;
  }

  /** Kick or voluntary leave. Only in LOBBY; later phases keep the seat (disconnect instead). */
  removePlayer(playerId: string): void {
    this.assertPhase('LOBBY');
    this.requirePlayer(playerId);
    this.players.delete(playerId);
    this.touch();
  }

  setPlayerConnected(playerId: string, connected: boolean): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connected = connected;
    this.touch();
  }

  getPlayer(playerId: string): PlayerRecord | undefined {
    return this.players.get(playerId);
  }

  /** Players in join order (join order decides initial positions in doubles). */
  listPlayers(): PlayerRecord[] {
    return [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  }

  // ── Host / settings ──────────────────────────────────────────────

  setHostConnected(connected: boolean): void {
    this.hostConnected = connected;
    this.touch();
  }

  setGameType(gameType: GameType): void {
    this.assertPhase('LOBBY');
    this.gameType = gameType;
    this.touch();
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
    this.touch();
  }

  // ── Phase transitions ────────────────────────────────────────────

  startTeamBuilding(): void {
    this.assertPhase('LOBBY');
    if (!this.composition().valid) throw new RoomError('INVALID_COMPOSITION');
    this.phase = 'TEAM_BUILDING';
    this.touch();
  }

  backToLobby(): void {
    this.assertPhase('TEAM_BUILDING', 'RESULTS');
    this.phase = 'LOBBY';
    this.touch();
  }

  // ── Queries ──────────────────────────────────────────────────────

  composition(): CompositionStatus {
    return evaluateComposition(this.gameType, this.teamSizes());
  }

  hasConnectedClients(): boolean {
    return this.hostConnected || [...this.players.values()].some((p) => p.connected);
  }

  toPublicState(): PublicRoomState {
    return {
      code: this.code,
      phase: this.phase,
      gameType: this.gameType,
      locale: this.locale,
      hostConnected: this.hostConnected,
      players: this.listPlayers().map(({ id, name, avatar, team, connected }) => ({
        id,
        name,
        avatar,
        team,
        connected,
      })),
      composition: this.composition(),
    };
  }

  // ── Internals ────────────────────────────────────────────────────

  private teamSizes(): Record<TeamId, number> {
    const sizes = Object.fromEntries(TEAM_IDS.map((t) => [t, 0])) as Record<TeamId, number>;
    for (const player of this.players.values()) sizes[player.team]++;
    return sizes;
  }

  private requirePlayer(playerId: string): PlayerRecord {
    const player = this.players.get(playerId);
    if (!player) throw new RoomError('PLAYER_NOT_FOUND');
    return player;
  }

  private assertPhase(...allowed: RoomPhase[]): void {
    if (!allowed.includes(this.phase)) {
      throw new RoomError('WRONG_PHASE', { phase: this.phase });
    }
  }

  private touch(): void {
    this.lastActivityAt = this.deps.now();
  }
}
