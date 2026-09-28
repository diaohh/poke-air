import type { AddressInfo } from 'node:net';
import {
  HOST_NAMESPACE,
  PLAYER_NAMESPACE,
  type HostClientToServerEvents,
  type HostServerToClientEvents,
  type PlayerClientToServerEvents,
  type PlayerServerToClientEvents,
  type PublicRoomState,
} from '@poke-air/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type PokeAirApp } from './app.js';
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

beforeEach(async () => {
  server = await buildApp({ config: testConfig, logger: false });
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  const { port } = server.app.server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
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
