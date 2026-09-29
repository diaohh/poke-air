import type {
  BuilderRandomSetPayload,
  ErrorCode,
  ErrorPayload,
  PokemonSetData,
} from '@poke-air/shared';
import { create } from 'zustand';
import { createPlayerSocket, type PlayerSocket } from '../lib/socket';

interface TeamsStore {
  online: boolean;
  /** A request is waiting for its ack. */
  busy: boolean;
  error?: ErrorCode | 'CONNECTION';
  errorParams?: ErrorPayload['params'];
  /** Opens this page's socket (no room, no seat). Returns a cleanup function. */
  open: () => () => void;
  validateSet: (set: PokemonSetData) => Promise<PokemonSetData | null>;
  randomSet: (payload: BuilderRandomSetPayload) => Promise<PokemonSetData | null>;
  parseTeam: (text: string) => Promise<PokemonSetData[] | null>;
  clearError: () => void;
}

let socket: PlayerSocket | undefined;

/**
 * The standalone team builder's connection (`/teams`, decision D-53): a `/player` socket that
 * never joins a room and only uses the stateless `builder:*` events (D-51). Teams live on the
 * phone (saved teams, D-39).
 */
export const useTeamsStore = create<TeamsStore>((set) => {
  /** Sends a builder request; stores the error code on failure. Returns the ack's data or null. */
  const request = async <T>(
    send: (s: PlayerSocket) => Promise<({ ok: true } & T) | { ok: false; error: ErrorPayload }>,
  ): Promise<T | null> => {
    if (!socket) return null;
    if (!socket.connected) {
      set({ error: 'CONNECTION', errorParams: undefined });
      return null;
    }
    set({ busy: true, error: undefined, errorParams: undefined });
    const result = await send(socket);
    if (result.ok) {
      set({ busy: false });
      return result;
    }
    set({ busy: false, error: result.error.code, errorParams: result.error.params });
    return null;
  };

  return {
    online: false,
    busy: false,

    open: () => {
      const current = createPlayerSocket();
      socket = current;
      current.on('connect', () => set({ online: true, error: undefined }));
      current.on('disconnect', () => set({ online: false }));
      current.on('connect_error', () => set({ online: false }));
      current.connect();
      return () => {
        current.removeAllListeners();
        current.disconnect();
        if (socket === current) socket = undefined;
      };
    },

    validateSet: async (pokemon) =>
      (await request((s) => s.emitWithAck('builder:validateSet', { set: pokemon })))?.set ?? null,
    randomSet: async (payload) =>
      (await request((s) => s.emitWithAck('builder:randomSet', payload)))?.set ?? null,
    parseTeam: async (text) =>
      (await request((s) => s.emitWithAck('builder:parseTeam', { text })))?.sets ?? null,
    clearError: () => set({ error: undefined, errorParams: undefined }),
  };
});
