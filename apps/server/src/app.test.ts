import type { AddressInfo } from 'node:net';
import {
  HOST_NAMESPACE,
  PLAYER_NAMESPACE,
  type BattleLogPayload,
  type BattleRequestPayload,
  type HostClientToServerEvents,
  type HostServerToClientEvents,
  type PlayerClientToServerEvents,
  type PlayerServerToClientEvents,
  type PublicRoomState,
  type TeamState,
} from '@poke-air/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type AppOptions, type PokeAirApp } from './app.js';
import type { Config } from './config.js';

type HostClient = Socket<HostServerToClientEvents, HostClientToServerEvents>;
type PlayerClient = Socket<PlayerServerToClientEvents, PlayerClientToServerEvents>;

const testConfig: Config = {
  isProduction: false,
  port: 0,
  host: '127.0.0.1',
  allowedOrigins: true,
  logLevel: 'silent',
  roomSweepIntervalMs: 60_000,
};

let server: PokeAirApp;
let baseUrl: string;
const clients: Socket[] = [];

/** Short countdown so battles start right away; the other timings stay realistic. */
const FAST_MATCH = { countdownMs: 30, animationTimeoutMs: 2_000, turnTimerMs: 60_000 };

async function startServer(realtime: AppOptions['realtime'] = { matchTimings: FAST_MATCH }) {
  server = await buildApp({ config: testConfig, logger: false, realtime });
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  const { port } = server.app.server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
}

beforeEach(async () => {
  await startServer();
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await server.close();
});

function hostClient(): HostClient {
  const socket: HostClient = connect(`${baseUrl}${HOST_NAMESPACE}`, {
    transports: ['websocket'],
    forceNew: true,
  });
  clients.push(socket);
  return socket;
}

function playerClient(): PlayerClient {
  const socket: PlayerClient = connect(`${baseUrl}${PLAYER_NAMESPACE}`, {
    transports: ['websocket'],
    forceNew: true,
  });
  clients.push(socket);
  return socket;
}

function nextState(socket: HostClient | PlayerClient): Promise<PublicRoomState> {
  return new Promise((resolve) => (socket as HostClient).once('room:state', resolve));
}

async function createRoom(host: HostClient) {
  const result = await host.emitWithAck('host:createRoom', {});
  if (!result.ok) throw new Error(result.error.code);
  return result;
}

describe('realtime lobby', () => {
  it('creates a room and lets a phone join it', async () => {
    const host = hostClient();
    const { code, hostToken, room } = await createRoom(host);
    expect(code).toMatch(/^[A-Z]{4}$/);
    expect(hostToken).toBeTruthy();
    expect(room.hostConnected).toBe(true);

    const phone = playerClient();
    const hostUpdate = nextState(host);
    const join = await phone.emitWithAck('player:join', {
      code: code.toLowerCase(),
      name: 'Ana',
      avatar: 'cynthia',
    });
    expect(join.ok).toBe(true);

    const state = await hostUpdate;
    expect(state.players).toEqual([
      expect.objectContaining({ name: 'Ana', avatar: 'cynthia', team: 'red', connected: true }),
    ]);
  });

  it('rejects invalid payloads and unknown rooms with error codes', async () => {
    const phone = playerClient();
    const invalid = await phone.emitWithAck('player:join', {
      code: 'AB',
      name: '',
      avatar: 'cynthia',
    });
    expect(invalid).toEqual({ ok: false, error: { code: 'INVALID_PAYLOAD' } });

    const missing = await phone.emitWithAck('player:join', {
      code: 'ZZZZ',
      name: 'Ana',
      avatar: 'cynthia',
    });
    expect(missing).toEqual({ ok: false, error: { code: 'ROOM_NOT_FOUND' } });
  });

  it('keeps the seat on disconnect and restores it with the reconnect token', async () => {
    const host = hostClient();
    const { code } = await createRoom(host);

    const phone = playerClient();
    const join = await phone.emitWithAck('player:join', { code, name: 'Ana', avatar: 'red' });
    if (!join.ok) throw new Error(join.error.code);

    const disconnected = nextState(host);
    phone.disconnect();
    expect((await disconnected).players[0]?.connected).toBe(false);

    const phoneAgain = playerClient();
    const rejoin = await phoneAgain.emitWithAck('player:join', {
      code,
      name: 'Ana',
      avatar: 'red',
      playerId: join.playerId,
      reconnectToken: join.reconnectToken,
    });
    if (!rejoin.ok) throw new Error(rejoin.error.code);
    expect(rejoin.playerId).toBe(join.playerId);
    expect(rejoin.room.players).toHaveLength(1);
    expect(rejoin.room.players[0]?.connected).toBe(true);
  });

  it('lets the host kick a player and resume the room after a refresh', async () => {
    const host = hostClient();
    const { code, hostToken } = await createRoom(host);

    const phone = playerClient();
    const join = await phone.emitWithAck('player:join', { code, name: 'Ben', avatar: 'lance' });
    if (!join.ok) throw new Error(join.error.code);

    const removed = new Promise((resolve) => phone.once('player:removed', resolve));
    const kick = await host.emitWithAck('host:kick', { playerId: join.playerId });
    expect(kick.ok).toBe(true);
    expect(await removed).toBe('kicked');

    host.disconnect();
    const hostAgain = hostClient();
    const resumed = await hostAgain.emitWithAck('host:resumeRoom', { code, hostToken });
    if (!resumed.ok) throw new Error(resumed.error.code);
    expect(resumed.room.players).toEqual([]);

    const wrong = await hostClient().emitWithAck('host:resumeRoom', { code, hostToken: 'nope' });
    expect(wrong).toEqual({ ok: false, error: { code: 'INVALID_HOST_TOKEN' } });
  });

  it('moves to team building only with a valid composition', async () => {
    const host = hostClient();
    const { code } = await createRoom(host);
    const a = playerClient();
    await a.emitWithAck('player:join', { code, name: 'A', avatar: 'red' });

    const early = await host.emitWithAck('host:startTeamBuilding', {});
    expect(early).toEqual({ ok: false, error: { code: 'INVALID_COMPOSITION' } });

    const b = playerClient();
    await b.emitWithAck('player:join', { code, name: 'B', avatar: 'blue' });
    const started = await host.emitWithAck('host:startTeamBuilding', {});
    expect(started.ok).toBe(true);
  });
});

/** Resolves with the first `event` payload that matches `predicate`. */
function waitFor<T>(
  socket: HostClient | PlayerClient,
  event: string,
  predicate: (payload: T) => boolean = () => true,
  timeoutMs = 10_000,
): Promise<T> {
  const target = socket as unknown as {
    on: (event: string, listener: (payload: T) => void) => void;
    off: (event: string, listener: (payload: T) => void) => void;
  };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      target.off(event, listener);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const listener = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      target.off(event, listener);
      resolve(payload);
    };
    target.on(event, listener);
  });
}

async function joinPlayer(code: string, name: string) {
  const phone = playerClient();
  const firstTeamState = waitFor<TeamState>(phone, 'team:state');
  const join = await phone.emitWithAck('player:join', { code, name, avatar: 'red' });
  if (!join.ok) throw new Error(join.error.code);
  await firstTeamState;
  return { phone, playerId: join.playerId, reconnectToken: join.reconnectToken };
}

/** Host + two phones in TEAM_BUILDING with one random Pokémon each. */
async function teamBuildingRoom() {
  const host = hostClient();
  const { code, hostToken } = await createRoom(host);
  const ana = await joinPlayer(code, 'Ana');
  const ben = await joinPlayer(code, 'Ben');
  const teams = Promise.all([ana, ben].map(({ phone }) => waitFor<TeamState>(phone, 'team:state')));
  const started = await host.emitWithAck('host:startTeamBuilding', {});
  expect(started.ok).toBe(true);
  expect((await teams).map((t) => t.quota)).toEqual([6, 6]);
  for (const { phone } of [ana, ben]) {
    const team = waitFor<TeamState>(phone, 'team:state');
    expect((await phone.emitWithAck('team:randomize', { slots: [0] })).ok).toBe(true);
    expect((await team).slots.filter(Boolean)).toHaveLength(1);
  }
  return { host, code, hostToken, ana, ben };
}

/** The Host "animates" instantly: acknowledges every log chunk as soon as it arrives. */
function autoAnimate(host: HostClient) {
  host.on('battle:log', ({ from, lines }: BattleLogPayload) => {
    void host.emitWithAck('host:animated', { upTo: from + lines.length });
  });
}

/** The phone answers every actionable request with `default`. */
function autoPlay(phone: PlayerClient) {
  phone.on('battle:request', ({ request, choice }: BattleRequestPayload) => {
    if (request && request.kind !== 'wait' && choice === null) {
      void phone.emitWithAck('battle:choose', { choice: 'default', rqid: request.rqid });
    }
  });
}

describe('realtime team building and battle', () => {
  it('keeps teams private and starts the battle once everyone is ready', async () => {
    const { host, ana, ben } = await teamBuildingRoom();

    const readyState = waitFor<PublicRoomState>(host, 'room:state', (s) =>
      s.players.some((p) => p.ready),
    );
    await ana.phone.emitWithAck('player:ready', { ready: true });
    const state = await readyState;
    expect(state.players.map((p) => [p.ready, p.teamCount, p.quota])).toEqual([
      [true, 1, 6],
      [false, 1, 6],
    ]);
    expect(JSON.stringify(state)).not.toMatch(/species|moves/);

    const battle = waitFor<PublicRoomState>(host, 'room:state', (s) => s.phase === 'BATTLE');
    const firstLog = waitFor<BattleLogPayload>(host, 'battle:log');
    const countdown = waitFor<PublicRoomState>(
      host,
      'room:state',
      (s) => s.battleCountdownMs !== null,
    );
    await ben.phone.emitWithAck('player:ready', { ready: true });
    expect((await countdown).battleCountdownMs).toBeGreaterThan(0);
    await battle;

    const log = await firstLog;
    expect(log.from).toBe(0);
    // Public HP only: the Host never sees exact HP.
    const switches = log.lines.filter((line) => line.startsWith('|switch|'));
    expect(switches).toHaveLength(2);
    expect(switches.every((line) => line.endsWith('100/100'))).toBe(true);

    // Phones get their menu once the Host has animated the switch-ins.
    const menu = waitFor<BattleRequestPayload>(ana.phone, 'battle:request', (p) => !!p.request);
    await host.emitWithAck('host:animated', { upTo: log.lines.length });
    const { request } = await menu;
    expect(request?.kind).toBe('move');
    expect(request?.active[0]?.moves[0]).toHaveProperty('category');

    const invalid = await ana.phone.emitWithAck('battle:choose', { choice: 'switch 2' });
    expect(invalid).toEqual({ ok: false, error: { code: 'INVALID_CHOICE' } });
    const malformed = await ana.phone.emitWithAck('battle:choose', { choice: 'move 1; eval' });
    expect(malformed).toEqual({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
  });

  it('plays a whole battle with default choices, then offers a rematch', async () => {
    const { host, ana, ben } = await teamBuildingRoom();
    autoAnimate(host);
    autoPlay(ana.phone);
    autoPlay(ben.phone);

    const results = waitFor<PublicRoomState>(
      host,
      'room:state',
      (s) => s.phase === 'RESULTS',
      30_000,
    );
    await ana.phone.emitWithAck('player:ready', { ready: true });
    await ben.phone.emitWithAck('player:ready', { ready: true });
    const { result } = await results;
    expect(result?.reason).toBe('normal');
    expect(result?.turns).toBeGreaterThan(0);
    expect(result && result.teams.red.kos + result.teams.blue.kos).toBeGreaterThan(0);

    const teamState = waitFor<TeamState>(ana.phone, 'team:state');
    const rematch = await host.emitWithAck('host:rematch', {});
    expect(rematch.ok).toBe(true);
    expect((await teamState).slots.filter(Boolean)).toHaveLength(1);
  }, 40_000);

  it('restores the battle for a refreshed phone and a refreshed Host', async () => {
    const { host, code, hostToken, ana, ben } = await teamBuildingRoom();
    autoAnimate(host);
    const menu = waitFor<BattleRequestPayload>(ana.phone, 'battle:request', (p) => !!p.request);
    await ana.phone.emitWithAck('player:ready', { ready: true });
    await ben.phone.emitWithAck('player:ready', { ready: true });
    const { request } = await menu;
    await ana.phone.emitWithAck('battle:choose', { choice: 'move 1', rqid: request?.rqid });

    // Phone refresh: same seat, same pending choice.
    ana.phone.disconnect();
    const again = playerClient();
    const restored = waitFor<BattleRequestPayload>(again, 'battle:request');
    const rejoin = await again.emitWithAck('player:join', {
      code,
      name: 'Ana',
      avatar: 'red',
      playerId: ana.playerId,
      reconnectToken: ana.reconnectToken,
    });
    expect(rejoin.ok).toBe(true);
    expect(await restored).toMatchObject({ request: { rqid: request?.rqid }, choice: 'move 1' });

    // Host refresh: the whole log comes back flagged as a resync.
    host.disconnect();
    const screen = hostClient();
    const resync = waitFor<BattleLogPayload>(screen, 'battle:log');
    const resumed = await screen.emitWithAck('host:resumeRoom', { code, hostToken });
    expect(resumed.ok && resumed.room.phase).toBe('BATTLE');
    const log = await resync;
    expect(log).toMatchObject({ from: 0, resync: true });
    expect(log.lines.some((line) => line.startsWith('|switch|'))).toBe(true);

    const forfeit = await ben.phone.emitWithAck('battle:forfeit', {});
    expect(forfeit.ok).toBe(true);
  });
});

describe('realtime abuse limits', () => {
  it('rate-limits joins and caps rooms per IP', async () => {
    await server.close();
    await startServer({ limits: { joinBurst: 2, maxRoomsPerIp: 1 } });

    const host = hostClient();
    const { code } = await createRoom(host);
    const tooMany = await hostClient().emitWithAck('host:createRoom', {});
    expect(tooMany).toEqual({ ok: false, error: { code: 'TOO_MANY_ROOMS' } });

    const join = (name: string) =>
      playerClient().emitWithAck('player:join', { code, name, avatar: 'red' });
    expect((await join('A')).ok).toBe(true);
    expect((await join('B')).ok).toBe(true);
    expect(await join('C')).toEqual({ ok: false, error: { code: 'RATE_LIMITED' } });
  });
});
