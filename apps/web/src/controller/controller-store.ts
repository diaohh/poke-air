import {
  randomTrainerAvatar,
  type ErrorCode,
  type PlayerRemovedReason,
  type PublicRoomState,
  type TeamId,
  type TrainerAvatar,
} from '@poke-air/shared';
import { create } from 'zustand';
import { createPlayerSocket, type PlayerSocket } from '../lib/socket';
import { local } from '../lib/storage';

type ControllerStatus = 'connecting' | 'form' | 'joining' | 'joined' | 'removed';

export interface Profile {
  name: string;
  avatar: TrainerAvatar;
}

interface Seat {
  playerId: string;
  reconnectToken: string;
}

interface ControllerStore {
  code?: string;
  status: ControllerStatus;
  online: boolean;
  room?: PublicRoomState;
  playerId?: string;
  profile: Profile;
  error?: ErrorCode | 'CONNECTION';
  removedReason?: PlayerRemovedReason;
  /** Opens the socket for a room code; auto-rejoins a saved seat. Returns a cleanup function. */
  open: (code: string) => () => void;
  setProfile: (profile: Partial<Profile>) => void;
  join: () => Promise<void>;
  switchTeam: (team: TeamId) => Promise<void>;
  leave: () => Promise<void>;
}

const PROFILE_KEY = 'profile';
const seatKey = (code: string) => `seat:${code}`;
let socket: PlayerSocket | undefined;

function initialProfile(): Profile {
  return local.get<Profile>(PROFILE_KEY) ?? { name: '', avatar: randomTrainerAvatar() };
}

export const useControllerStore = create<ControllerStore>((set, get) => {
  /** Joins (or rejoins, when a seat is saved) with the current profile. */
  const sendJoin = async () => {
    const { code, profile } = get();
    if (!socket || !code) return;
    const seat = local.get<Seat>(seatKey(code));
    set({ status: 'joining', error: undefined });
    // After a kick the server closes the socket; emits are buffered until it reconnects.
    if (!socket.connected) socket.connect();

    const result = await socket.emitWithAck('player:join', {
      code,
      name: profile.name,
      avatar: profile.avatar,
      ...seat,
    });

    if (result.ok) {
      local.set(seatKey(code), {
        playerId: result.playerId,
        reconnectToken: result.reconnectToken,
      });
      set({ status: 'joined', playerId: result.playerId, room: result.room });
      return;
    }
    if (seat) local.set(seatKey(code), undefined); // Stale seat: fall back to a fresh join.
    set({ status: 'form', error: result.error.code });
  };

  return {
    status: 'connecting',
    online: false,
    profile: initialProfile(),

    open: (rawCode) => {
      const code = rawCode.toUpperCase();
      const current = createPlayerSocket();
      socket = current;
      const hasSeat = Boolean(local.get<Seat>(seatKey(code)));
      set({ code, status: 'connecting', room: undefined, error: undefined });

      current.on('connect', () => {
        set({ online: true });
        // Auto-rejoin on first connect (saved seat) and on every reconnect after joining.
        const { status } = get();
        if (status === 'joined' || (status === 'connecting' && hasSeat)) void sendJoin();
        else if (status === 'connecting') set({ status: 'form' });
      });
      current.on('disconnect', () => set({ online: false }));
      current.on('connect_error', () => set({ online: false }));
      current.on('room:state', (room) => set({ room }));
      current.on('player:removed', (reason) => {
        local.set(seatKey(code), undefined);
        set({ status: 'removed', removedReason: reason, room: undefined, playerId: undefined });
      });
      current.connect();

      return () => {
        current.removeAllListeners();
        current.disconnect();
        if (socket === current) socket = undefined;
      };
    },

    setProfile: (changes) => {
      const profile = { ...get().profile, ...changes };
      local.set(PROFILE_KEY, profile);
      set({ profile });
    },

    join: sendJoin,

    switchTeam: async (team) => {
      if (!socket) return;
      const result = await socket.emitWithAck('player:switchTeam', { team });
      if (!result.ok) set({ error: result.error.code });
    },

    leave: async () => {
      const { code } = get();
      if (!socket || !code) return;
      const result = await socket.emitWithAck('player:leave', {});
      if (!result.ok) {
        set({ error: result.error.code });
        return;
      }
      local.set(seatKey(code), undefined);
      set({ status: 'form', room: undefined, playerId: undefined });
    },
  };
});
