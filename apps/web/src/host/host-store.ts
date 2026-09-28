import type {
  BattleLogPayload,
  BattleWaiting,
  EffectDuration,
  ErrorCode,
  GameType,
  Locale,
  MoveMeta,
  PublicRoomState,
} from '@poke-air/shared';
import { create } from 'zustand';
import { createHostSocket, type HostSocket } from '../lib/socket';
import { session } from '../lib/storage';

type ConnectionStatus = 'connecting' | 'online' | 'offline';

interface SavedHostSession {
  code: string;
  hostToken: string;
}

/** Public battle log as the Host plays it (append-only; `epoch` changes when it is replaced). */
export interface HostBattleLog {
  lines: string[];
  moves: Record<string, MoveMeta>;
  /** Dex durations of the timed effects seen in the log (weather, screens…). */
  effects: Record<string, EffectDuration>;
  epoch: number;
  /** The current log was received as a resync (refresh mid-battle): don't animate the past. */
  resync: boolean;
}

/** `battle:waiting` + when it arrived, so the timer can count down locally. */
export interface ReceivedWaiting extends BattleWaiting {
  receivedAt: number;
}

interface HostStore {
  connection: ConnectionStatus;
  room?: PublicRoomState;
  /** When the last `room:state` arrived (local clock), for its countdown. */
  roomAt: number;
  battle: HostBattleLog;
  waiting?: ReceivedWaiting;
  error?: ErrorCode | 'CONNECTION';
  /** Opens the socket and creates (or resumes) the room. Returns a cleanup function. */
  start: () => () => void;
  setFormat: (gameType: GameType) => Promise<void>;
  setLocale: (locale: Locale) => Promise<void>;
  kick: (playerId: string) => Promise<void>;
  startTeamBuilding: () => Promise<void>;
  backToLobby: () => Promise<void>;
  rematch: () => Promise<void>;
  /** The scene has shown the log up to `upTo` lines (releases the phones' next menu). */
  animated: (upTo: number) => void;
  clearError: () => void;
}

const SESSION_KEY = 'host';
let socket: HostSocket | undefined;
let lastAnimated = 0;

/** Appends a `battle:log` chunk (skipping lines already received), or replaces the log. */
export function mergeBattleLog(log: HostBattleLog, payload: BattleLogPayload): HostBattleLog {
  if (payload.from === 0) {
    return {
      lines: payload.lines,
      moves: payload.moves,
      effects: payload.effects,
      epoch: log.epoch + 1,
      resync: Boolean(payload.resync),
    };
  }
  const fresh = payload.lines.slice(Math.max(0, log.lines.length - payload.from));
  if (fresh.length === 0) return log;
  return {
    ...log,
    lines: [...log.lines, ...fresh],
    moves: { ...log.moves, ...payload.moves },
    effects: { ...log.effects, ...payload.effects },
  };
}

export const useHostStore = create<HostStore>((set, get) => {
  /** Applies an ack result: stores the error code on failure. */
  const settle = (result: { ok: true } | { ok: false; error: { code: ErrorCode } }) => {
    if (!result.ok) set({ error: result.error.code });
  };

  return {
    connection: 'connecting',
    roomAt: 0,
    battle: { lines: [], moves: {}, effects: {}, epoch: 0, resync: false },

    start: () => {
      const current = createHostSocket();
      socket = current;

      current.on('connect', async () => {
        set({ connection: 'online', error: undefined });
        // Resume the room after a refresh (sessionStorage survives reloads, not new tabs).
        const saved = session.get<SavedHostSession>(SESSION_KEY);
        if (saved) {
          const resumed = await current.emitWithAck('host:resumeRoom', saved);
          if (resumed.ok) {
            set({ room: resumed.room, roomAt: Date.now() });
            return;
          }
        }
        const created = await current.emitWithAck('host:createRoom', {});
        if (!created.ok) {
          set({ error: created.error.code });
          return;
        }
        session.set(SESSION_KEY, { code: created.code, hostToken: created.hostToken });
        set({ room: created.room, roomAt: Date.now() });
      });
      current.on('disconnect', () => set({ connection: 'offline' }));
      current.on('connect_error', () => set({ connection: 'offline' }));
      current.on('room:state', (room) => {
        // Outside a battle the old log is dead: the next battle's scene must not replay it.
        const { battle } = get();
        const cleared =
          room.phase !== 'BATTLE' && battle.lines.length > 0
            ? {
                battle: {
                  lines: [],
                  moves: {},
                  effects: {},
                  epoch: battle.epoch + 1,
                  resync: false,
                },
              }
            : {};
        set({ room, roomAt: Date.now(), ...cleared });
      });
      current.on('battle:log', (payload) => {
        if (payload.from === 0) lastAnimated = 0;
        set({ battle: mergeBattleLog(get().battle, payload) });
      });
      current.on('battle:waiting', (waiting) =>
        set({ waiting: { ...waiting, receivedAt: Date.now() } }),
      );
      current.connect();

      return () => {
        current.removeAllListeners();
        current.disconnect();
        if (socket === current) socket = undefined;
      };
    },

    setFormat: async (gameType) => {
      if (socket) settle(await socket.emitWithAck('host:setFormat', { gameType }));
    },
    setLocale: async (locale) => {
      if (socket) settle(await socket.emitWithAck('host:setLocale', { locale }));
    },
    kick: async (playerId) => {
      if (socket) settle(await socket.emitWithAck('host:kick', { playerId }));
    },
    startTeamBuilding: async () => {
      if (socket) settle(await socket.emitWithAck('host:startTeamBuilding', {}));
    },
    backToLobby: async () => {
      if (socket) settle(await socket.emitWithAck('host:backToLobby', {}));
    },
    rematch: async () => {
      if (socket) settle(await socket.emitWithAck('host:rematch', {}));
    },
    animated: (upTo) => {
      if (!socket || upTo <= lastAnimated) return;
      lastAnimated = upTo;
      // Fire and forget: the server has its own timeout if this never arrives.
      socket.emit('host:animated', { upTo }, () => {});
    },
    clearError: () => set({ error: undefined }),
  };
});
