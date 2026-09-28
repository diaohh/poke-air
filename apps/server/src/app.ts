import { networkInterfaces } from 'node:os';
import cors from '@fastify/cors';
import { RoomManager } from '@poke-air/core';
import Fastify, { type FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import type { Config } from './config.js';
import { registerHostHandlers } from './transport/host-handlers.js';
import { registerPlayerHandlers } from './transport/player-handlers.js';
import { Realtime } from './transport/realtime.js';

export interface AppOptions {
  config: Config;
  rooms?: RoomManager;
  /** Pino logger options; `false` disables logging (tests). */
  logger?: boolean | Record<string, unknown>;
}

export interface PokeAirApp {
  app: FastifyInstance;
  io: Server;
  rooms: RoomManager;
  close: () => Promise<void>;
}

/** Builds Fastify + Socket.IO without listening, so tests can start it on a random port. */
export async function buildApp({ config, rooms = new RoomManager(), logger }: AppOptions) {
  const app = Fastify({
    logger: logger ?? {
      level: config.logLevel,
      ...(config.isProduction ? {} : { transport: { target: 'pino-pretty' } }),
    },
  });

  await app.register(cors, { origin: config.allowedOrigins });

  app.get('/healthz', async () => ({ ok: true, rooms: rooms.size }));

  // Dev helper: LAN addresses so the Host can build a QR that phones on the same Wi-Fi can open.
  app.get('/api/info', async () => ({
    lanAddresses: config.isProduction ? [] : lanAddresses(),
  }));

  const io = new Server(app.server, {
    cors: { origin: config.allowedOrigins },
    // Phones drop connections when the screen locks; give them time to come back.
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });

  const realtime = new Realtime(io, rooms, app.log);
  registerHostHandlers(realtime);
  registerPlayerHandlers(realtime);

  const sweepTimer = setInterval(() => {
    const removed = rooms.sweep();
    if (removed.length > 0) app.log.info({ removed }, 'Idle rooms removed');
  }, config.roomSweepIntervalMs);
  sweepTimer.unref();

  const close = async () => {
    clearInterval(sweepTimer);
    await io.close();
    await app.close();
  };

  return { app, io, rooms, close } satisfies PokeAirApp;
}

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net!.address);
}
