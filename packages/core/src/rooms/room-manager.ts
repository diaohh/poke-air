import { DEFAULT_LOCALE, ROOM_IDLE_TTL_MS, type Locale } from '@poke-air/shared';
import { Room, type RoomDeps } from './room.js';
import { generateRoomCode, type RandomInt } from './room-code.js';
import { RoomError } from './room-error.js';

export interface RoomManagerDeps extends RoomDeps {
  randomInt: RandomInt;
  idleTtlMs: number;
}

const MAX_CODE_ATTEMPTS = 100;

// Web Crypto (global in Node 22+ and browsers) keeps packages/core runtime-agnostic.
const defaultRandomInt: RandomInt = (maxExclusive) => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] ?? 0) % maxExclusive;
};

/** In-memory registry of rooms. One instance per server process. */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly deps: RoomManagerDeps;

  constructor(deps: Partial<RoomManagerDeps> = {}) {
    this.deps = {
      now: deps.now ?? Date.now,
      newId: deps.newId ?? (() => crypto.randomUUID()),
      randomInt: deps.randomInt ?? defaultRandomInt,
      idleTtlMs: deps.idleTtlMs ?? ROOM_IDLE_TTL_MS,
    };
  }

  createRoom(options: { locale?: Locale } = {}): Room {
    const code = this.uniqueCode();
    const room = new Room(
      { code, hostToken: this.deps.newId(), locale: options.locale ?? DEFAULT_LOCALE },
      this.deps,
    );
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  require(code: string): Room {
    const room = this.get(code);
    if (!room) throw new RoomError('ROOM_NOT_FOUND');
    return room;
  }

  delete(code: string): void {
    this.rooms.delete(code.toUpperCase());
  }

  get size(): number {
    return this.rooms.size;
  }

  /** Removes rooms with no connected clients and no activity for `idleTtlMs`. Returns removed codes. */
  sweep(): string[] {
    const cutoff = this.deps.now() - this.deps.idleTtlMs;
    const removed: string[] = [];
    for (const [code, room] of this.rooms) {
      if (!room.hasConnectedClients() && room.lastActivityAt <= cutoff) {
        this.rooms.delete(code);
        removed.push(code);
      }
    }
    return removed;
  }

  private uniqueCode(): string {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateRoomCode(this.deps.randomInt);
      if (!this.rooms.has(code)) return code;
    }
    throw new RoomError('INTERNAL_ERROR');
  }
}
