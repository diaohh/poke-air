import { describe, expect, it } from 'vitest';
import type { ShowdownSet } from '../battle/showdown.js';
import { TeamService } from '../team/team-service.js';
import { Room } from './room.js';
import { RoomError } from './room-error.js';

const SPECIES = [
  'Pikachu',
  'Garchomp',
  'Dragonite',
  'Rotom-Wash',
  'Blissey',
  'Gengar',
  'Lucario',
  'Scizor',
];

/** Cycles through SPECIES so every randomize call is deterministic. */
function fakeTeamService() {
  let offset = 0;
  return new TeamService(() => {
    const batch = Array.from({ length: 6 }, (_, i) => SPECIES[(offset + i) % SPECIES.length] ?? '');
    offset += 1;
    return batch.map(
      (species) =>
        ({
          name: species,
          species,
          item: '',
          ability: 'Static',
          moves: ['tackle'],
          evs: {},
        }) as ShowdownSet,
    );
  });
}

function createRoom() {
  let clock = 1_000;
  let ids = 0;
  const room = new Room(
    { code: 'ABCD', hostToken: 'host-token', locale: 'en' },
    { now: () => clock, newId: () => `id-${++ids}`, teamService: fakeTeamService() },
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

describe('Room teams and battle phases', () => {
  function teamBuilding(gameType: 'singles' | 'doubles' = 'singles', extra = 0) {
    const setup = createRoom();
    const { room, advance } = setup;
    if (gameType === 'doubles') room.setGameType('doubles');
    const players = [];
    for (let i = 0; i < 2 + extra; i++) {
      players.push(room.addPlayer({ name: `P${i}`, avatar: 'red' }));
      advance(1);
    }
    room.startTeamBuilding();
    return { ...setup, players };
  }

  it('sizes teams by quota: 6 alone on a team, 3 with a teammate', () => {
    const { room, players } = teamBuilding('doubles', 1); // red: P0, P2 · blue: P1
    const [a, b, c] = players.map((p) => p.id) as [string, string, string];
    expect(room.teamState(a).quota).toBe(3);
    expect(room.teamState(c).quota).toBe(3);
    expect(room.teamState(b).quota).toBe(6);
    expect(room.teamState(b).slots).toEqual([null, null, null, null, null, null]);
  });

  it('randomizes whole teams or single slots without duplicating species on a side', () => {
    const { room, players } = teamBuilding('doubles', 1);
    const [a, , c] = players.map((p) => p.id) as [string, string, string];
    room.randomizeTeam(a);
    room.randomizeTeam(c);
    const species = [a, c].flatMap((id) => room.teamState(id).slots.map((s) => s?.species));
    expect(species.every(Boolean)).toBe(true);
    expect(new Set(species).size).toBe(6);

    const before = room.teamState(a).slots;
    const after = room.randomizeTeam(a, [1]).slots;
    expect(after[0]).toEqual(before[0]);
    expect(after[2]).toEqual(before[2]);
    expect(after[1]?.species).not.toBe(before[1]?.species);
    expect(() => room.randomizeTeam(a, [3])).toThrowError('INVALID_SLOT');
  });

  it('shows only counts publicly, never species', () => {
    const { room, players } = teamBuilding();
    const id = players[0]?.id ?? '';
    room.randomizeTeam(id);
    room.clearSlot(id, 0);
    const state = room.toPublicState();
    expect(state.players[0]).toMatchObject({ teamCount: 5, quota: 6, ready: false });
    expect(JSON.stringify(state)).not.toContain(room.teamState(id).slots[1]?.species ?? '?');
  });

  it('needs a Pokémon to be ready, and any team change un-readies', () => {
    const { room, players } = teamBuilding();
    const id = players[0]?.id ?? '';
    expectRoomError(() => room.setReady(id, true), 'EMPTY_TEAM');
    room.randomizeTeam(id, [0]);
    room.setReady(id, true);
    expect(room.getPlayer(id)?.ready).toBe(true);
    room.clearSlot(id, 3);
    expect(room.getPlayer(id)?.ready).toBe(false);
  });

  it('starts the battle only when everyone is ready', () => {
    const { room, players } = teamBuilding();
    const [a, b] = players.map((p) => p.id) as [string, string];
    room.randomizeTeam(a);
    room.randomizeTeam(b, [0, 1]);
    room.setReady(a, true);
    expect(room.allReady()).toBe(false);
    expectRoomError(() => room.startBattle(), 'PLAYERS_NOT_READY');
    room.setReady(b, true);
    expect(room.allReady()).toBe(true);
    room.startBattle();
    expect(room.phase).toBe('BATTLE');
    expectRoomError(() => room.randomizeTeam(a), 'WRONG_PHASE');

    const sides = room.battleSides();
    expect(sides.p1).toMatchObject({ team: 'red', name: 'P0' });
    expect(sides.p1.players[0]?.sets).toHaveLength(6);
    expect(sides.p2.players[0]?.sets).toHaveLength(2);
  });

  it('goes BATTLE → RESULTS → TEAM_BUILDING (rematch) keeping teams, or back to the lobby', () => {
    const { room, players } = teamBuilding();
    const [a, b] = players.map((p) => p.id) as [string, string];
    for (const id of [a, b]) {
      room.randomizeTeam(id);
      room.setReady(id, true);
    }
    const team = room.teamState(a).slots;
    room.startBattle();
    const summary = { kos: 0, remaining: 6, total: 6 };
    room.finishBattle({
      winner: 'red',
      reason: 'normal',
      turns: 3,
      teams: { red: summary, blue: summary },
    });
    expect(room.toPublicState()).toMatchObject({ phase: 'RESULTS', result: { winner: 'red' } });

    room.rematch();
    expect(room.phase).toBe('TEAM_BUILDING');
    expect(room.result).toBeNull();
    expect(room.getPlayer(a)?.ready).toBe(false);
    expect(room.teamState(a).slots).toEqual(team);

    room.backToLobby();
    expect(room.phase).toBe('LOBBY');
  });

  it('keeps stored sets while players move in the lobby and trims them on team building', () => {
    const { room, players, advance } = teamBuilding('doubles');
    const [a] = players.map((p) => p.id) as [string, string];
    room.randomizeTeam(a);
    room.backToLobby();
    advance(1);
    const c = room.addPlayer({ name: 'C', avatar: 'red' }); // joins red: quota 3 while in LOBBY
    expect(room.teamState(a).slots).toHaveLength(3);
    room.switchTeam(c.id, 'blue');
    expect(room.teamState(a).slots.filter(Boolean)).toHaveLength(6); // nothing was lost
  });

  it('exposes the countdown as remaining time', () => {
    const { room, advance } = teamBuilding(); // clock is at 1_002 after two joins
    room.setCountdown(1_002 + 3_000);
    advance(1_000);
    expect(room.toPublicState().battleCountdownMs).toBe(2_000);
    advance(5_000);
    expect(room.toPublicState().battleCountdownMs).toBe(0);
  });
});

describe('Room team editing (Phase 2) and doubles minimums (Phase 3)', () => {
  /** A doubles room in TEAM_BUILDING: red Ana + Cleo, blue Ben. */
  function doubles() {
    const { room, advance } = createRoom();
    room.setGameType('doubles');
    const ids = ['Ana', 'Ben', 'Cleo'].map((name) => {
      advance(1);
      return room.addPlayer({ name, avatar: 'red' }).id;
    }) as [string, string, string];
    room.startTeamBuilding();
    return { room, ana: ids[0], ben: ids[1], cleo: ids[2] };
  }

  const set = (species: string, moves: string[], ability: string, item = '') => ({
    name: species,
    species,
    item,
    ability,
    moves,
    nature: 'Jolly',
    evs: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
    level: 50,
  });
  const GARCHOMP = set('Garchomp', ['Earthquake'], 'Rough Skin', 'Garchompite');
  const PIKACHU = set('Pikachu', ['Thunderbolt'], 'Static', 'Light Ball');
  const LUCARIO = set('Lucario', ['Close Combat'], 'Justified');

  it('needs two Pokémon for a solo doubles side and one per player of a pair', () => {
    const { room, ana, ben, cleo } = doubles();
    expect(room.teamState(ben)).toMatchObject({ quota: 6, minimum: 2 });
    expect(room.teamState(ana)).toMatchObject({ quota: 3, minimum: 1 });
    room.setSlot(ben, 0, PIKACHU);
    expectRoomError(() => room.setReady(ben, true), 'TEAM_TOO_SMALL');
    room.setSlot(ben, 1, GARCHOMP);
    room.setReady(ben, true);
    room.setSlot(cleo, 0, LUCARIO);
    room.setReady(cleo, true);
    expect(room.getPlayer(cleo)?.ready).toBe(true);
  });

  it('keeps a singles minimum of one', () => {
    const { room } = createRoom();
    const a = room.addPlayer({ name: 'A', avatar: 'red' });
    room.addPlayer({ name: 'B', avatar: 'red' });
    room.startTeamBuilding();
    expect(room.teamState(a.id).minimum).toBe(1);
  });

  it('saves a validated set, and enforces Species Clause across teammates', () => {
    const { room, ana, ben, cleo } = doubles();
    const state = room.setSlot(ana, 2, { ...GARCHOMP, name: 'Chompy' });
    // Saved in the first empty slot (compaction) and normalized.
    expect(state.slots[0]).toMatchObject({ name: 'Garchomp', species: 'Garchomp' });
    expect(() => room.setSlot(cleo, 0, GARCHOMP)).toThrowError('SPECIES_CLAUSE');
    expect(() => room.setSlot(ana, 1, { ...GARCHOMP, species: 'Garchomp-Mega' })).toThrowError(
      'SPECIES_CLAUSE',
    );
    // The other team may bring the same species.
    room.setSlot(ben, 0, GARCHOMP);
    expect(() => room.setSlot(ana, 3, PIKACHU)).toThrowError('INVALID_SLOT');
    expect(() => room.setSlot(ana, 1, { ...PIKACHU, moves: ['Spore'] })).toThrowError(
      'INVALID_SET',
    );
  });

  it('un-readies on edits and compacts the slots when a Pokémon is removed', () => {
    const { room, ana } = doubles();
    room.setSlot(ana, 0, GARCHOMP);
    room.setSlot(ana, 1, PIKACHU);
    room.setSlot(ana, 2, LUCARIO);
    room.setReady(ana, true);
    const state = room.setSlot(ana, 0, null);
    expect(state.slots.map((s) => s?.species ?? null)).toEqual(['Pikachu', 'Lucario', null]);
    expect(room.getPlayer(ana)?.ready).toBe(false);
  });

  it('imports up to the quota, leaving out species a teammate already brought', () => {
    const { room, ana, cleo } = doubles();
    room.setSlot(cleo, 0, PIKACHU);
    const text = [
      'Pikachu @ Light Ball\nAbility: Static\n- Thunderbolt',
      'Garchomp @ Garchompite\nAbility: Rough Skin\n- Earthquake',
      'Lucario\nAbility: Justified\n- Close Combat',
      'Dragonite\nAbility: Multiscale\n- Extreme Speed',
      'Gengar\nAbility: Cursed Body\n- Shadow Ball',
    ].join('\n\n');
    const result = room.importTeam(ana, text);
    expect(result.state.slots.map((s) => s?.species)).toEqual(['Garchomp', 'Lucario', 'Dragonite']);
    expect(result).toMatchObject({ count: 3, skipped: 2 });

    expectRoomError(
      () => room.importTeam(cleo, 'Garchomp\nAbility: Rough Skin\n- Earthquake'),
      'SPECIES_CLAUSE',
    );
    expectRoomError(() => room.importTeam(ana, ''), 'INVALID_IMPORT');
  });
});
