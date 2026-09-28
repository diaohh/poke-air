import type {
  BattleLogPayload,
  BattleRequestPayload,
  BattleWaiting,
  PokemonSetData,
} from '@poke-air/shared';
import { describe, expect, it } from 'vitest';
import { Room } from '../rooms/room.js';
import { TeamService } from '../team/team-service.js';
import { createFakeScheduler } from '../testing/fake-scheduler.js';
import { GARCHOMP, MAGIKARP, PIKACHU, SEED } from '../testing/fixtures.js';
import { MatchController } from './match-controller.js';
import type { ShowdownSet } from './showdown.js';

const TIMINGS = { countdownMs: 3_000, turnTimerMs: 60_000, animationTimeoutMs: 15_000 };

/**
 * A 1v1 singles room in TEAM_BUILDING: Ana (red) gets `red`, Ben (blue) gets `blue`.
 * `ready` readies both players.
 */
function setup(red: PokemonSetData[], blue: PokemonSetData[], { ready = true } = {}) {
  const scheduler = createFakeScheduler();
  const batches = [red, blue].map((sets) => sets as unknown as ShowdownSet[]);
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
  const ana = room.addPlayer({ name: 'Ana', avatar: 'cynthia' }).id;
  scheduler.advance(1);
  const ben = room.addPlayer({ name: 'Ben', avatar: 'lance' }).id;
  room.setHostConnected(true);
  room.startTeamBuilding();
  room.randomizeTeam(
    ana,
    red.map((_, i) => i),
  );
  room.randomizeTeam(
    ben,
    blue.map((_, i) => i),
  );

  const logs: BattleLogPayload[] = [];
  const requests = new Map<string, BattleRequestPayload[]>();
  const waiting: BattleWaiting[] = [];
  let roomChanges = 0;
  const match = new MatchController(
    room,
    {
      roomChanged: () => roomChanges++,
      battleLog: (payload) => logs.push(payload),
      request: (playerId, payload) =>
        requests.set(playerId, [...(requests.get(playerId) ?? []), payload]),
      waiting: (payload) => waiting.push(payload),
    },
    { scheduler, timings: TIMINGS, seed: () => SEED },
  );

  const lastRequest = (playerId: string) => requests.get(playerId)?.at(-1);
  const logLength = () => logs.reduce((n, payload) => n + payload.lines.length, 0);
  const startBattle = () => {
    room.setReady(ana, true);
    room.setReady(ben, true);
    match.sync();
    scheduler.advance(TIMINGS.countdownMs);
  };
  /** Starts the battle and lets the Host "animate" everything so far. */
  const startAndAnimate = () => {
    startBattle();
    match.hostAnimated(logLength());
  };
  if (ready) {
    room.setReady(ana, true);
    room.setReady(ben, true);
  }
  return {
    scheduler,
    room,
    match,
    ana,
    ben,
    logs,
    waiting,
    lastRequest,
    logLength,
    startBattle,
    startAndAnimate,
    roomChanges: () => roomChanges,
  };
}

describe('MatchController · countdown', () => {
  it('starts a cancellable countdown when everyone is ready, then the battle', () => {
    const t = setup([GARCHOMP], [MAGIKARP]);
    t.match.sync();
    expect(t.room.toPublicState().battleCountdownMs).toBe(3_000);

    t.room.setReady(t.ben, false);
    t.match.sync();
    expect(t.room.toPublicState().battleCountdownMs).toBeNull();
    t.scheduler.advance(10_000);
    expect(t.room.phase).toBe('TEAM_BUILDING');

    t.room.setReady(t.ben, true);
    t.match.sync();
    t.scheduler.advance(2_999);
    expect(t.room.phase).toBe('TEAM_BUILDING');
    t.scheduler.advance(1);
    expect(t.room.phase).toBe('BATTLE');
    expect(t.roomChanges()).toBe(1);
    expect(t.logs[0]?.from).toBe(0);
    expect(t.logs[0]?.lines.join('\n')).toContain('|switch|p2a: Magikarp');
  });
});

describe('MatchController · animation sync', () => {
  it('holds requests until the Host has animated the log that led to them', () => {
    const t = setup([GARCHOMP], [MAGIKARP], { ready: false });
    t.startBattle();
    expect(t.lastRequest(t.ana)).toEqual({ request: null, choice: null });
    expect(t.match.waiting().waitingFor).toEqual([]);

    t.match.hostAnimated(t.logLength() - 1);
    expect(t.lastRequest(t.ana)?.request).toBeNull();

    t.match.hostAnimated(t.logLength());
    const request = t.lastRequest(t.ana)?.request;
    expect(request).toMatchObject({ kind: 'move', side: 'p1' });
    expect(request?.active[0]?.moves[0]).toMatchObject({
      name: 'Earthquake',
      type: 'Ground',
      category: 'Physical',
      basePower: 100,
      accuracy: 100,
    });
    expect(request?.active[0]?.canMegaEvo).toBe(true);
    expect(t.waiting.at(-1)).toEqual({ waitingFor: [t.ana, t.ben], timerMs: 60_000 });
  });

  it('releases requests after the fallback timeout if the Host never answers', () => {
    const t = setup([GARCHOMP], [MAGIKARP], { ready: false });
    t.startBattle();
    t.scheduler.advance(14_999);
    expect(t.lastRequest(t.ben)?.request).toBeNull();
    t.scheduler.advance(1);
    expect(t.lastRequest(t.ben)?.request?.kind).toBe('move');
  });

  it('does not wait for a Host that is offline', () => {
    const t = setup([GARCHOMP], [MAGIKARP], { ready: false });
    t.startBattle();
    t.room.setHostConnected(false);
    t.match.sync();
    expect(t.lastRequest(t.ana)?.request?.kind).toBe('move');
  });

  it('gives a reattached Host the whole log to resync', () => {
    const t = setup([GARCHOMP], [MAGIKARP]);
    expect(t.match.resyncLog()).toBeNull();
    t.startAndAnimate();
    const resync = t.match.resyncLog();
    expect(resync).toMatchObject({ from: 0, resync: true });
    expect(resync?.lines).toHaveLength(t.logLength());
  });
});

describe('MatchController · choices', () => {
  it('tracks who is still choosing and supports undo', () => {
    const t = setup([GARCHOMP], [MAGIKARP, PIKACHU]);
    t.startAndAnimate();
    const rqid = t.lastRequest(t.ana)?.request?.rqid;

    expect(() => t.match.choose(t.ana, 'move 1', (rqid ?? 0) + 1)).toThrowError('STALE_REQUEST');
    t.match.choose(t.ana, 'move 1', rqid);
    expect(t.match.waiting().waitingFor).toEqual([t.ben]);
    expect(t.match.requestFor(t.ana).choice).toBe('move 1');
    expect(() => t.match.choose(t.ana, 'move 2')).toThrowError('ALREADY_CHOSEN');

    t.match.undo(t.ana);
    expect(t.match.waiting().waitingFor).toEqual([t.ana, t.ben]);
    expect(() => t.match.undo(t.ana)).toThrowError('CANT_UNDO');
    expect(() => t.match.choose(t.ben, 'move 3')).toThrowError('INVALID_CHOICE');
  });

  it('resolves the turn, then asks only the fainted side for a switch', () => {
    const t = setup([GARCHOMP], [MAGIKARP, PIKACHU]);
    t.startAndAnimate();
    t.match.choose(t.ana, 'move 1');
    t.match.choose(t.ben, 'move 1');

    // New decision: both phones watch the screen until the Host has animated the turn.
    expect(t.lastRequest(t.ben)).toEqual({ request: null, choice: null });
    expect(t.logs.at(-1)?.moves).toEqual({ Earthquake: { type: 'Ground', category: 'Physical' } });
    t.match.hostAnimated(t.logLength());

    expect(t.lastRequest(t.ben)?.request).toMatchObject({ kind: 'switch', forceSwitch: [true] });
    expect(t.lastRequest(t.ana)?.request?.kind).toBe('wait');
    expect(t.match.waiting().waitingFor).toEqual([t.ben]);
    expect(() => t.match.choose(t.ana, 'move 1')).toThrowError('NO_PENDING_REQUEST');

    t.match.choose(t.ben, 'switch 2');
    t.match.hostAnimated(t.logLength());
    expect(t.lastRequest(t.ana)?.request?.kind).toBe('move');
    expect(t.lastRequest(t.ben)?.request?.pokemon.find((p) => p.active)?.species).toBe('Pikachu');
  });

  it('auto-completes missing choices with default when the turn timer runs out', () => {
    const t = setup([GARCHOMP], [MAGIKARP, PIKACHU]);
    t.startAndAnimate();
    t.match.choose(t.ana, 'move 3'); // Swords Dance
    t.scheduler.advance(59_999);
    expect(t.match.waiting().waitingFor).toEqual([t.ben]);
    t.scheduler.advance(1);
    expect(t.logs.at(-1)?.lines.join('\n')).toContain('|move|p2a: Magikarp|Splash|');
    expect(t.match.waiting()).toEqual({ waitingFor: [], timerMs: null });
  });
});

describe('MatchController · end of battle', () => {
  it('moves to RESULTS once the Host has shown the final blow', () => {
    const t = setup([GARCHOMP], [MAGIKARP]);
    t.startAndAnimate();
    t.match.choose(t.ana, 'move 1');
    t.match.choose(t.ben, 'move 1');
    expect(t.room.phase).toBe('BATTLE');
    expect(() => t.match.choose(t.ana, 'move 1')).toThrowError('NO_ACTIVE_BATTLE');

    t.match.hostAnimated(t.logLength());
    expect(t.room.phase).toBe('RESULTS');
    expect(t.room.result).toEqual({
      winner: 'red',
      reason: 'normal',
      turns: 1,
      teams: {
        red: { kos: 1, remaining: 1, total: 1 },
        blue: { kos: 0, remaining: 0, total: 1 },
      },
    });
    expect(t.match.inBattle).toBe(false);
  });

  it('does not wait forever for the Host at the end either', () => {
    const t = setup([GARCHOMP], [MAGIKARP]);
    t.startAndAnimate();
    t.match.choose(t.ana, 'move 1');
    t.match.choose(t.ben, 'move 1');
    t.scheduler.advance(15_000);
    expect(t.room.phase).toBe('RESULTS');
  });

  it('ends with a forfeit and allows a rematch with the same teams', () => {
    const t = setup([GARCHOMP], [MAGIKARP]);
    t.startAndAnimate();
    t.match.forfeit(t.ana);
    t.match.hostAnimated(t.logLength());
    expect(t.room.result).toMatchObject({ winner: 'blue', reason: 'forfeit' });

    t.room.rematch();
    t.match.sync();
    expect(t.room.phase).toBe('TEAM_BUILDING');
    expect(t.room.teamState(t.ana).slots[0]?.species).toBe('Garchomp');
    expect(t.room.toPublicState().battleCountdownMs).toBeNull();
  });

  it('rejects battle actions when no battle runs', () => {
    const t = setup([GARCHOMP], [MAGIKARP]);
    expect(() => t.match.choose(t.ana, 'move 1')).toThrowError('NO_ACTIVE_BATTLE');
    expect(() => t.match.forfeit(t.ana)).toThrowError('NO_ACTIVE_BATTLE');
    expect(t.match.requestFor(t.ana)).toEqual({ request: null, choice: null });
  });
});
