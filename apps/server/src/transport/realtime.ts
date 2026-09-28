import type { Room, RoomManager } from '@poke-air/core';
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

/**
 * Shared realtime context: namespaces, room registry and the "which socket currently owns this
 * seat" maps used for session replacement, kicks and disconnect tracking.
 */
export class Realtime {
  readonly hosts: HostNamespace;
  readonly players: PlayerNamespace;
  /** room code → socket id of the Host screen currently attached to it */
  readonly hostSocketByRoom = new Map<string, string>();
  /** player id → socket id of the phone currently attached to that seat */
  readonly playerSocketById = new Map<string, string>();

  constructor(
    io: Server,
    readonly rooms: RoomManager,
    readonly logger: FastifyBaseLogger,
  ) {
    this.hosts = io.of(HOST_NAMESPACE) as unknown as HostNamespace;
    this.players = io.of(PLAYER_NAMESPACE) as unknown as PlayerNamespace;
  }

  /** Sends the public room snapshot to the Host screen and every phone in the room. */
  broadcast(room: Room): void {
    const state = room.toPublicState();
    this.hosts.to(room.code).emit('room:state', state);
    this.players.to(room.code).emit('room:state', state);
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
