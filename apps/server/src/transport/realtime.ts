import { MatchController, type MatchTimings, type Room, type RoomManager } from '@poke-air/core';
import {
  HOST_NAMESPACE,
  PLAYER_NAMESPACE,
  type HostClientToServerEvents,
  type HostServerToClientEvents,
  type PlayerClientToServerEvents,
  type PlayerServerToClientEvents,
} from '@poke-air/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { Namespace, Server, Socket } from 'socket.io';
import { RateLimiter } from './rate-limit.js';

export interface HostSocketData {
  code?: string;
}

export interface PlayerSocketData {
  code?: string;
  playerId?: string;
}

export type HostNamespace = Namespace<
  HostClientToServerEvents,
  HostServerToClientEvents,
  Record<string, never>,
  HostSocketData
>;
export type PlayerNamespace = Namespace<
  PlayerClientToServerEvents,
  PlayerServerToClientEvents,
  Record<string, never>,
  PlayerSocketData
>;
export type HostSocket = Socket<
  HostClientToServerEvents,
  HostServerToClientEvents,
  Record<string, never>,
  HostSocketData
>;
export type PlayerSocket = Socket<
  PlayerClientToServerEvents,
  PlayerServerToClientEvents,
  Record<string, never>,
  PlayerSocketData
>;

/** Abuse limits per client IP (docs/02-architecture.md § Basic security). */
export interface RealtimeLimits {
  /** `player:join` burst and refill per IP. */
  joinBurst: number;
  joinPerSecond: number;
  /** `host:createRoom` burst and refill per IP. */
  createBurst: number;
  createPerSecond: number;
  /** Rooms one IP may keep open at the same time. */
  maxRoomsPerIp: number;
}

export const DEFAULT_LIMITS: RealtimeLimits = {
  joinBurst: 12,
  joinPerSecond: 1,
  createBurst: 5,
  createPerSecond: 1 / 30,
  maxRoomsPerIp: 5,
};

export interface RealtimeOptions {
  limits?: Partial<RealtimeLimits>;
  matchTimings?: Partial<MatchTimings>;
  /** Behind a reverse proxy (production): read the client IP from `x-forwarded-for`. */
  trustProxy?: boolean;
}

/**
 * Shared realtime context: namespaces, room registry, one `MatchController` per room, and the
 * "which socket currently owns this seat" maps used for session replacement, kicks and
 * disconnect tracking.
 */
export class Realtime {
  readonly hosts: HostNamespace;
  readonly players: PlayerNamespace;
  /** room code → socket id of the Host screen currently attached to it */
  readonly hostSocketByRoom = new Map<string, string>();
  /** player id → socket id of the phone currently attached to that seat */
  readonly playerSocketById = new Map<string, string>();
  /** room code → IP that created it (max rooms per IP) */
  readonly roomOwnerIp = new Map<string, string>();
  readonly limits: RealtimeLimits;
  readonly joinLimiter: RateLimiter;
  readonly createLimiter: RateLimiter;
  private readonly matches = new Map<string, MatchController>();

  constructor(
    io: Server,
    readonly rooms: RoomManager,
    readonly logger: FastifyBaseLogger,
    private readonly options: RealtimeOptions = {},
  ) {
    this.hosts = io.of(HOST_NAMESPACE) as unknown as HostNamespace;
    this.players = io.of(PLAYER_NAMESPACE) as unknown as PlayerNamespace;
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };
    this.joinLimiter = new RateLimiter({
      capacity: this.limits.joinBurst,
      refillPerSecond: this.limits.joinPerSecond,
    });
    this.createLimiter = new RateLimiter({
      capacity: this.limits.createBurst,
      refillPerSecond: this.limits.createPerSecond,
    });
  }

  /** Sends the public room snapshot to the Host screen and every phone in the room. */
  broadcast(room: Room): void {
    const state = room.toPublicState();
    this.hosts.to(room.code).emit('room:state', state);
    this.players.to(room.code).emit('room:state', state);
  }

  /** Each phone gets its own slots (after quota changes: entering team building, rematch). */
  sendTeamStates(room: Room): void {
    for (const player of room.listPlayers()) {
      this.playerSocket(player.id)?.emit('team:state', room.teamState(player.id));
    }
  }

  /** The room's battle orchestrator; its outputs become socket emits. */
  match(room: Room): MatchController {
    let match = this.matches.get(room.code);
    if (!match) {
      match = new MatchController(
        room,
        {
          roomChanged: () => this.broadcast(room),
          battleLog: (payload) => this.hosts.to(room.code).emit('battle:log', payload),
          request: (playerId, payload) =>
            this.playerSocket(playerId)?.emit('battle:request', payload),
          waiting: (payload) => {
            this.hosts.to(room.code).emit('battle:waiting', payload);
            this.players.to(room.code).emit('battle:waiting', payload);
          },
        },
        {
          ...(this.options.matchTimings ? { timings: this.options.matchTimings } : {}),
          onError: (error) =>
            this.logger.error({ err: error, code: room.code }, 'Simulator crashed; battle ended'),
        },
      );
      this.matches.set(room.code, match);
    }
    return match;
  }

  /** Frees everything bound to a room that no longer exists (idle sweep). */
  forgetRoom(code: string): void {
    this.matches.get(code)?.destroy();
    this.matches.delete(code);
    this.roomOwnerIp.delete(code);
    this.hostSocketByRoom.delete(code);
  }

  /** Rooms currently open that were created from `ip`. */
  roomsOwnedBy(ip: string): number {
    let count = 0;
    for (const [code, owner] of this.roomOwnerIp) {
      if (owner === ip && this.rooms.get(code)) count++;
    }
    return count;
  }

  clientIp(socket: Socket): string {
    if (this.options.trustProxy) {
      const forwarded = socket.handshake.headers['x-forwarded-for'];
      const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
      if (first) return first;
    }
    return socket.handshake.address;
  }

  playerSocket(playerId: string): PlayerSocket | undefined {
    const socketId = this.playerSocketById.get(playerId);
    return socketId ? this.players.sockets.get(socketId) : undefined;
  }

  hostSocket(code: string): HostSocket | undefined {
    const socketId = this.hostSocketByRoom.get(code);
    return socketId ? this.hosts.sockets.get(socketId) : undefined;
  }
}
