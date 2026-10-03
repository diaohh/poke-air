import type {
  BattleLogPayload,
  BattleRequestPayload,
  PokemonSetData,
  TeamId,
} from '@poke-air/shared';
import { describe, expect, it } from 'vitest';
import { Room } from '../rooms/room.js';
import { TeamService } from '../team/team-service.js';
import { createFakeScheduler } from '../testing/fake-scheduler.js';
import { GARCHOMP, MAGIKARP, PIKACHU, SEED, testSet } from '../testing/fixtures.js';
import { MatchController } from './match-controller.js';
import { battleName } from './request.js';
import type { ShowdownSet } from './showdown.js';

/**
 * Scripted doubles battles with the real simulator and a fixed seed (docs/14-phase-3-plan.md § Tests
 * to add): the OwnershipLayer as the MatchController drives it. Blue Pokémon only Splash, so every
 * turn is deterministic: Garchomp's Dragon Claw and Pikachu's Light Ball Thunderbolt one-shot them.
 */

const TIMINGS = {
  countdownMs: 3_000,
  turnTimerMs: 60_000,
  doublesTurnTimerMs: 90_000,
  animationTimeoutMs: 15_000,
};

const FEEBAS = testSet('Feebas', ['Splash'], '', 'Swift Swim');
const BLISSEY = testSet('Blissey', ['Splash'], '', 'Natural Cure');
const CHANSEY = testSet('Chansey', ['Splash'], '', 'Natural Cure');
const LUCARIO = testSet('Lucario', ['Swords Dance', 'Close Combat'], 'Lucarionite', 'Justified');

interface Seat {
  name: string;
  team: TeamId;
  sets: PokemonSetData[];
}

/**
 * A doubles room in TEAM_BUILDING with these players (joined in this order), each with their sets,
 * everyone ready; `start()` runs the countdown and lets the Host animate the leads.
 */
function setup(seats: Seat[]) {
  const scheduler = createFakeScheduler();
  const batches = seats.map((seat) => seat.sets as unknown as ShowdownSet[]);
  let call = 0;
  let ids = 0;
  const room = new Room(
    { code: 'ABCD', hostToken: 'h', locale: 'en' },
    {
      now: scheduler.now,
      newId: () => `id${++ids}`,
      teamService: new TeamService(() => batches[call++] ?? []),
    },
  );
  room.setGameType('doubles');
  const playerIds: Record<string, string> = {};
  for (const seat of seats) {
    const player = room.addPlayer({ name: seat.name, avatar: 'red' });
    if (player.team !== seat.team) room.switchTeam(player.id, seat.team);
    playerIds[seat.name] = player.id;
    scheduler.advance(1);
  }
  room.setHostConnected(true);
  room.startTeamBuilding();
  for (const seat of seats) {
    room.randomizeTeam(
      playerIds[seat.name] ?? '',
      seat.sets.map((_, i) => i),
    );
    room.setReady(playerIds[seat.name] ?? '', true);
  }

  const logs: BattleLogPayload[] = [];
  const requests = new Map<string, BattleRequestPayload[]>();
  const match = new MatchController(
    room,
    {
      roomChanged: () => {},
      battleLog: (payload) => logs.push(payload),
      request: (playerId, payload) =>
        requests.set(playerId, [...(requests.get(playerId) ?? []), payload]),
      waiting: () => {},
    },
    { scheduler, timings: TIMINGS, seed: () => SEED },
  );

  const id = (name: string) => playerIds[name] ?? '';
  const logLength = () => logs.reduce((n, payload) => n + payload.lines.length, 0);
  const log = () => logs.flatMap((payload) => payload.lines).join('\n');
  const animate = () => match.hostAnimated(logLength());
  return {
    scheduler,
    room,
    match,
    id,
    log,
    animate,
    request: (name: string) => requests.get(id(name))?.at(-1)?.request ?? null,
    choose: (name: string, choice: string) => match.choose(id(name), choice),
    waitingFor: () => match.waiting().waitingFor,
    start: () => {
      match.sync();
      scheduler.advance(TIMINGS.countdownMs);
      animate();
    },
  };
}

const red = (name: string, sets: PokemonSetData[]): Seat => ({ name, team: 'red', sets });
const blue = (name: string, sets: PokemonSetData[]): Seat => ({ name, team: 'blue', sets });

describe('MatchController · doubles 2v2', () => {
  const twoVsTwo = () =>
    setup([
      red('Ana', [GARCHOMP, LUCARIO]),
      blue('Ben', [MAGIKARP, BLISSEY, CHANSEY]),
      red('Cleo', [PIKACHU]),
      blue('Dan', [FEEBAS]),
    ]);

  it("leads with every player's first Pokémon, first-joined on the left", () => {
    const t = twoVsTwo();
    t.start();
    expect(t.log()).toContain('|switch|p1a: Garchomp|');
    expect(t.log()).toContain('|switch|p1b: Pikachu|');
    expect(t.log()).toContain('|switch|p2a: Magikarp|');
    expect(t.log()).toContain('|switch|p2b: Feebas|');
  });

  it('splits the side request per player and merges their parts with targets', () => {
    const t = twoVsTwo();
    t.start();
    const ana = t.request('Ana');
    expect(ana?.active.map((a) => [a.position, a.pokemon])).toEqual([[0, 'Garchomp']]);
    expect(ana?.pokemon.map((p) => p.name)).toEqual(['Garchomp', 'Lucario']);
    expect(ana?.field.foe.map((slot) => slot?.name)).toEqual(['Magikarp', 'Feebas']);
    expect(t.request('Cleo')?.active.map((a) => a.position)).toEqual([1]);
    expect(JSON.stringify(t.request('Cleo'))).not.toContain('Lucario');

    expect(() => t.choose('Ana', 'move 2')).toThrowError('INVALID_CHOICE'); // no target
    t.choose('Ana', 'move 2 1'); // Dragon Claw → Magikarp
    expect(t.waitingFor()).toEqual([t.id('Cleo'), t.id('Ben'), t.id('Dan')]);
    t.choose('Ben', 'move 1');
    t.choose('Dan', 'move 1');
    t.choose('Cleo', 'move 1 2'); // Thunderbolt → Feebas

    expect(t.log()).toContain('|move|p1a: Garchomp|Dragon Claw|p2a: Magikarp');
    expect(t.log()).toContain('|move|p1b: Pikachu|Thunderbolt|p2b: Feebas');
    expect(t.log()).toContain('|faint|p2a: Magikarp');
    expect(t.log()).toContain('|faint|p2b: Feebas');
  });

  it('asks the owner for a replacement and hands the ally hole over when the owner has none', () => {
    const t = twoVsTwo();
    t.start();
    t.choose('Ana', 'move 2 1');
    t.choose('Cleo', 'move 1 2');
    t.choose('Ben', 'move 1');
    t.choose('Dan', 'move 1');
    t.animate();

    // Ben fills both holes: his own (Magikarp) and Dan's (Feebas), since Dan has nothing left.
    expect(t.request('Ben')).toMatchObject({
      kind: 'switch',
      forceSwitch: [
        { position: 0, pokemon: 'Magikarp' },
        { position: 1, pokemon: 'Feebas' },
      ],
    });
    expect(t.request('Dan')?.kind).toBe('wait');
    expect(t.request('Ana')?.kind).toBe('wait');
    expect(t.waitingFor()).toEqual([t.id('Ben')]);

    t.choose('Ben', 'switch 3, switch 4');
    t.animate();
    expect(t.log()).toContain('|switch|p2a: Blissey|');
    expect(t.log()).toContain('|switch|p2b: Chansey|');
    // Dan has nothing on the field: Ben controls both positions now.
    expect(t.request('Ben')?.active.map((a) => a.pokemon)).toEqual(['Blissey', 'Chansey']);
    expect(t.request('Dan')?.kind).toBe('wait');
  });

  it('allows one Mega per team per turn and keeps each player’s own quota', () => {
    const t = setup([
      red('Ana', [GARCHOMP]),
      blue('Ben', [MAGIKARP]),
      red('Cleo', [LUCARIO]),
      blue('Dan', [FEEBAS]),
    ]);
    t.start();
    expect(t.request('Ana')?.megasLeft).toBe(1);
    t.choose('Cleo', 'move 1 mega'); // Swords Dance + Mega Lucario
    expect(t.request('Ana')?.allyMega).toBe(true);
    expect(() => t.choose('Ana', 'move 3 mega')).toThrowError('MEGA_TAKEN');
    t.choose('Ana', 'move 3'); // Swords Dance
    t.choose('Ben', 'move 1');
    t.choose('Dan', 'move 1');
    t.animate();

    expect(t.log()).toContain('|-mega|p1b: Lucario|');
    expect(t.request('Cleo')?.megasLeft).toBe(0);
    expect(t.request('Ana')).toMatchObject({ megasLeft: 1, allyMega: false });
    expect(t.request('Ana')?.active[0]?.canMegaEvo).toBe(true);
    // Swords Dance shows as a stat stage in the owner's sheet.
    expect(t.request('Ana')?.pokemon[0]?.boosts).toEqual({ atk: 2 });

    t.choose('Ana', 'move 3 mega');
    t.choose('Cleo', 'move 1');
    t.choose('Ben', 'move 1');
    t.choose('Dan', 'move 1');
    expect(t.log()).toContain('|-mega|p1a: Garchomp|');
  });

  it('auto-completes only the missing part when the 90 s timer runs out', () => {
    const t = setup([
      red('Ana', [GARCHOMP]),
      blue('Ben', [MAGIKARP]),
      red('Cleo', [LUCARIO]),
      blue('Dan', [FEEBAS]),
    ]);
    t.start();
    t.choose('Ana', 'move 3'); // Swords Dance
    t.choose('Ben', 'move 1');
    t.choose('Dan', 'move 1');
    t.scheduler.advance(89_999);
    expect(t.waitingFor()).toEqual([t.id('Cleo')]);
    t.scheduler.advance(1);
    expect(t.log()).toContain('|move|p1a: Garchomp|Swords Dance|');
    // Cleo's automatic action: her first move, never a Mega.
    expect(t.log()).toContain('|move|p1b: Lucario|Swords Dance|');
    expect(t.log()).not.toContain('|-mega|');
  });

  it("undoes one player's part without touching the teammate's", () => {
    const t = setup([
      red('Ana', [GARCHOMP]),
      blue('Ben', [MAGIKARP]),
      red('Cleo', [LUCARIO]),
      blue('Dan', [FEEBAS]),
    ]);
    t.start();
    t.choose('Ana', 'move 3');
    t.choose('Cleo', 'move 1');
    // The merged side choice was sent; the turn still waits for blue.
    t.match.undo(t.id('Ana'));
    expect(t.waitingFor()).toEqual([t.id('Ana'), t.id('Ben'), t.id('Dan')]);
    expect(t.match.requestFor(t.id('Cleo')).choice).toBe('move 1');
    expect(t.match.requestFor(t.id('Ana')).choice).toBeNull();
    t.choose('Ana', 'move 2 1');
    expect(t.waitingFor()).toEqual([t.id('Ben'), t.id('Dan')]);
  });
});

describe('MatchController · doubles 1v1 and 1v2', () => {
  it('lets a solo player decide both positions with one comma-separated choice', () => {
    const t = setup([red('Ana', [GARCHOMP, PIKACHU]), blue('Ben', [MAGIKARP, FEEBAS])]);
    t.start();
    expect(t.request('Ana')?.active.map((a) => a.pokemon)).toEqual(['Garchomp', 'Pikachu']);
    expect(() => t.choose('Ana', 'move 2 1')).toThrowError('INVALID_CHOICE');
    t.choose('Ana', 'move 2 1, move 1 2');
    t.choose('Ben', 'move 1, move 1');
    t.animate();
    expect(t.room.phase).toBe('RESULTS');
    expect(t.room.result).toMatchObject({ winner: 'red', reason: 'normal', turns: 1 });
  });

  it('gives the solo player of a 1v2 two Megas, on different turns', () => {
    const t = setup([
      red('Ana', [GARCHOMP, LUCARIO]),
      blue('Ben', [MAGIKARP]),
      blue('Dan', [FEEBAS]),
    ]);
    t.start();
    expect(t.request('Ana')?.megasLeft).toBe(2);
    expect(() => t.choose('Ana', 'move 3 mega, move 1 mega')).toThrowError('MEGA_TAKEN');
    t.choose('Ana', 'move 3 mega, move 1');
    t.choose('Ben', 'move 1');
    t.choose('Dan', 'move 1');
    t.animate();
    expect(t.request('Ana')?.megasLeft).toBe(1);

    t.choose('Ana', 'move 3, move 1 mega');
    t.choose('Ben', 'move 1');
    t.choose('Dan', 'move 1');
    t.animate();
    expect(t.log()).toContain('|-mega|p1a: Garchomp|');
    expect(t.log()).toContain('|-mega|p1b: Lucario|');
    expect(t.request('Ana')?.megasLeft).toBe(0);
  });
});

describe('MatchController · formes and owner-only data', () => {
  it('matches a forme named after its base species to its owner set (nature, Stat Points)', () => {
    const rotom: PokemonSetData = {
      ...testSet('Rotom-Wash', ['Hydro Pump', 'Protect'], 'Leftovers', 'Levitate'),
      nature: 'Modest',
    };
    expect(battleName(rotom)).toBe('Rotom');
    const t = setup([red('Ana', [rotom, GARCHOMP]), blue('Ben', [MAGIKARP, FEEBAS])]);
    t.start();
    const own = t.request('Ana')?.pokemon.find((p) => p.species === 'Rotom-Wash');
    expect(own).toMatchObject({
      name: 'Rotom',
      nature: { name: 'Modest', plus: 'spa', minus: 'atk' },
      statPoints: rotom.evs,
    });
    expect(t.request('Ana')?.active.map((a) => a.pokemon)).toEqual(['Rotom', 'Garchomp']);
  });
});
