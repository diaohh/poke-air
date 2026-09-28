import type { ErrorCode, GameType, Locale, PublicRoomState } from '@poke-air/shared';
import { create } from 'zustand';
import { createHostSocket, type HostSocket } from '../lib/socket';
import { session } from '../lib/storage';

type ConnectionStatus = 'connecting' | 'online' | 'offline';

interface SavedHostSession {
  code: string;
  hostToken: string;
}

interface HostStore {
  connection: ConnectionStatus;
  room?: PublicRoomState;
  error?: ErrorCode | 'CONNECTION';
  /** Opens the socket and creates (or resumes) the room. Returns a cleanup function. */
  start: () => () => void;
  setFormat: (gameType: GameType) => Promise<void>;
  setLocale: (locale: Locale) => Promise<void>;
  kick: (playerId: string) => Promise<void>;
  startTeamBuilding: () => Promise<void>;
  backToLobby: () => Promise<void>;
  clearError: () => void;
}

const SESSION_KEY = 'host';
let socket: HostSocket | undefined;

export const useHostStore = create<HostStore>((set) => {
  /** Applies an ack result: stores the error code on failure. */
  const settle = (result: { ok: true } | { ok: false; error: { code: ErrorCode } }) => {
    if (!result.ok) set({ error: result.error.code });
  };

  return {
    connection: 'connecting',

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
            set({ room: resumed.room });
            return;
          }
        }
        const created = await current.emitWithAck('host:createRoom', {});
        if (!created.ok) {
          set({ error: created.error.code });
          return;
        }
        session.set(SESSION_KEY, { code: created.code, hostToken: created.hostToken });
        set({ room: created.room });
      });
      current.on('disconnect', () => set({ connection: 'offline' }));
      current.on('connect_error', () => set({ connection: 'offline' }));
      current.on('room:state', (room) => set({ room }));
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
    clearError: () => set({ error: undefined }),
  };
});
