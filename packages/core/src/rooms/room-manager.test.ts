import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@poke-air/shared';
import { describe, expect, it } from 'vitest';
import { RoomManager } from './room-manager.js';
import { RoomError } from './room-error.js';

describe('RoomManager', () => {
  it('creates rooms with valid, unique codes', () => {
    const manager = new RoomManager();
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const room = manager.createRoom();
      expect(room.code).toHaveLength(ROOM_CODE_LENGTH);
      expect([...room.code].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
      codes.add(room.code);
    }
    expect(codes.size).toBe(200);
    expect(manager.size).toBe(200);
  });

  it('retries on code collisions', () => {
    // First code "AAAA" twice, then "BBBB".
    const sequence = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1];
    const manager = new RoomManager({ randomInt: () => sequence.shift() ?? 2 });
    expect(manager.createRoom().code).toBe('AAAA');
    expect(manager.createRoom().code).toBe('BBBB');
  });

  it('looks rooms up case-insensitively and throws ROOM_NOT_FOUND', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();
    expect(manager.get(room.code.toLowerCase())).toBe(room);
    expect(() => manager.require('ZZZZ')).toThrow(RoomError);
  });

  it('sweeps idle rooms without connected clients only', () => {
    let clock = 0;
    const manager = new RoomManager({ now: () => clock, idleTtlMs: 1_000 });
    const idle = manager.createRoom();
    const active = manager.createRoom();
    active.setHostConnected(true);

    clock = 5_000;
    expect(manager.sweep()).toEqual([idle.code]);
    expect(manager.get(active.code)).toBe(active);
  });
});
