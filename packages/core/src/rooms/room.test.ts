import { describe, expect, it } from 'vitest';
import { Room } from './room.js';
import { RoomError } from './room-error.js';

function createRoom() {
  let clock = 1_000;
  let ids = 0;
  const room = new Room(
    { code: 'ABCD', hostToken: 'host-token', locale: 'en' },
    { now: () => clock, newId: () => `id-${++ids}` },
  );
  return {
    room,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

function expectRoomError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(RoomError);
    expect((error as RoomError).code).toBe(code);
    return;
  }
  throw new Error(`Expected RoomError ${code}`);
}

describe('Room', () => {
  it('starts in LOBBY with singles and no players', () => {
    const { room } = createRoom();
    const state = room.toPublicState();
    expect(state.phase).toBe('LOBBY');
    expect(state.gameType).toBe('singles');
    expect(state.players).toEqual([]);
    expect(state.composition).toMatchObject({ valid: false, label: '0v0' });
  });

  it('auto-assigns joining players to the smaller team, red on ties', () => {
    const { room, advance } = createRoom();
    const a = room.addPlayer({ name: 'Ana', avatar: 'cynthia' });
    advance(1);
    const b = room.addPlayer({ name: 'Ben', avatar: 'lance' });
    advance(1);
    const c = room.addPlayer({ name: 'Carla', avatar: 'red' });
    expect([a.team, b.team, c.team]).toEqual(['red', 'blue', 'red']);
  });

  it('issues distinct ids and reconnect tokens', () => {
    const { room } = createRoom();
    const a = room.addPlayer({ name: 'Ana', avatar: 'cynthia' });
    expect(a.id).not.toBe(a.reconnectToken);
  });

  it('rejects a fifth player (v1 max is 2v2)', () => {
    const { room } = createRoom();
    for (const name of ['A', 'B', 'C', 'D']) room.addPlayer({ name, avatar: 'red' });
    expectRoomError(() => room.addPlayer({ name: 'E', avatar: 'red' }), 'ROOM_FULL');
  });

  it('lets players switch teams unless the target team is full', () => {
    const { room } = createRoom();
    const a = room.addPlayer({ name: 'A', avatar: 'red' });
    room.addPlayer({ name: 'B', avatar: 'red' });
    room.addPlayer({ name: 'C', avatar: 'red' }); // red: A, C · blue: B
    room.switchTeam(a.id, 'blue'); // red: C · blue: A, B
    expect(room.getPlayer(a.id)?.team).toBe('blue');
    const d = room.addPlayer({ name: 'D', avatar: 'red' }); // red: C, D
    expectRoomError(() => room.switchTeam(d.id, 'blue'), 'TEAM_FULL');
  });

  it('derives composition validity from the format', () => {
    const { room } = createRoom();
    room.addPlayer({ name: 'A', avatar: 'red' });
    room.addPlayer({ name: 'B', avatar: 'red' });
    expect(room.composition()).toMatchObject({ valid: true, label: '1v1' });

    room.addPlayer({ name: 'C', avatar: 'red' });
    expect(room.composition()).toMatchObject({
      valid: false,
      label: '2v1',
      issues: [{ team: 'red', issue: 'TEAM_TOO_LARGE' }],
    });

    room.setGameType('doubles');
    expect(room.composition()).toMatchObject({ valid: true, label: '2v1' });
  });

  it('only starts team building with a valid composition', () => {
    const { room } = createRoom();
    room.addPlayer({ name: 'A', avatar: 'red' });
    expectRoomError(() => room.startTeamBuilding(), 'INVALID_COMPOSITION');
    room.addPlayer({ name: 'B', avatar: 'red' });
    room.startTeamBuilding();
    expect(room.phase).toBe('TEAM_BUILDING');
  });

  it('blocks lobby-only actions outside LOBBY', () => {
    const { room } = createRoom();
    const a = room.addPlayer({ name: 'A', avatar: 'red' });
    room.addPlayer({ name: 'B', avatar: 'red' });
    room.startTeamBuilding();
    expectRoomError(() => room.addPlayer({ name: 'C', avatar: 'red' }), 'WRONG_PHASE');
    expectRoomError(() => room.switchTeam(a.id, 'blue'), 'WRONG_PHASE');
    expectRoomError(() => room.setGameType('doubles'), 'WRONG_PHASE');
    expectRoomError(() => room.removePlayer(a.id), 'WRONG_PHASE');
    room.backToLobby();
    expect(room.phase).toBe('LOBBY');
  });

  it('lets a player rejoin their seat with the right token, in any phase', () => {
    const { room } = createRoom();
    const a = room.addPlayer({ name: 'A', avatar: 'red' });
    room.addPlayer({ name: 'B', avatar: 'red' });
    room.startTeamBuilding();
    room.setPlayerConnected(a.id, false);
    expect(room.getPlayer(a.id)?.connected).toBe(false);

    expectRoomError(() => room.rejoinPlayer(a.id, 'wrong'), 'INVALID_RECONNECT_TOKEN');
    expectRoomError(() => room.rejoinPlayer('nobody', a.reconnectToken), 'PLAYER_NOT_FOUND');
    room.rejoinPlayer(a.id, a.reconnectToken);
    expect(room.getPlayer(a.id)?.connected).toBe(true);
  });

  it('never exposes reconnect tokens in the public state', () => {
    const { room } = createRoom();
    const a = room.addPlayer({ name: 'A', avatar: 'red' });
    const json = JSON.stringify(room.toPublicState());
    expect(json).not.toContain(a.reconnectToken);
    expect(json).not.toContain('host-token');
  });

  it('lists players in join order', () => {
    const { room, advance } = createRoom();
    room.addPlayer({ name: 'First', avatar: 'red' });
    advance(10);
    room.addPlayer({ name: 'Second', avatar: 'red' });
    expect(room.listPlayers().map((p) => p.name)).toEqual(['First', 'Second']);
  });
});
