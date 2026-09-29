import {
  randomTrainerAvatar,
  type BattleRequestPayload,
  type BattleWaiting,
  type ErrorCode,
  type ErrorPayload,
  type PlayerRemovedReason,
  type PokemonSetData,
  type PublicRoomState,
  type TeamId,
  type TeamImportResult,
  type TeamState,
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
  /** When the last `room:state` arrived (local clock), for its countdown. */
  roomAt: number;
  playerId?: string;
  profile: Profile;
  /** Own team (owner-only `team:state`). */
  team?: TeamState;
  /** Current battle menu; `null` until the first `battle:request` of a battle. */
  battle: BattleRequestPayload | null;
  waiting?: BattleWaiting & { receivedAt: number };
  /** A team/battle action is waiting for its ack. */
  busy: boolean;
  error?: ErrorCode | 'CONNECTION';
  /** Params of the last error (e.g. the validator's details for `INVALID_SET`). */
  errorParams?: ErrorPayload['params'];
  removedReason?: PlayerRemovedReason;
  /** Opens the socket for a room code; auto-rejoins a saved seat. Returns a cleanup function. */
  open: (code: string) => () => void;
  setProfile: (profile: Partial<Profile>) => void;
  join: () => Promise<void>;
  switchTeam: (team: TeamId) => Promise<void>;
  leave: () => Promise<void>;
  randomize: (slots?: number[]) => Promise<void>;
  clearSlot: (slot: number) => Promise<void>;
  /** Saves an edited set; `true` when the server accepted it. */
  saveSlot: (slot: number, set: PokemonSetData) => Promise<boolean>;
  /** Replaces the team with Showdown text; the ack's counts, or `null` on error. */
  importTeam: (text: string) => Promise<TeamImportResult | null>;
  /** A new set for this species (the editor's 🎲, not stored until saved); `null` on error. */
  randomSet: (species: string) => Promise<PokemonSetData | null>;
  setReady: (ready: boolean) => Promise<void>;
  choose: (choice: string) => Promise<void>;
  undo: () => Promise<void>;
  forfeit: () => Promise<void>;
  clearError: () => void;
}

const PROFILE_KEY = 'profile';
const seatKey = (code: string) => `seat:${code}`;
let socket: PlayerSocket | undefined;
/** A `battle:choose` waiting for its ack (request id + the choice sent). */
let pendingChoice: { rqid: number; choice: string } | null = null;

function initialProfile(): Profile {
  return local.get<Profile>(PROFILE_KEY) ?? { name: '', avatar: randomTrainerAvatar() };
}

/** A short buzz when the phone has something new to decide (ignored where unsupported). */
function buzz(): void {
  try {
    navigator.vibrate?.(60);
  } catch {
    // Not critical.
  }
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
      set({
        status: 'joined',
        playerId: result.playerId,
        room: result.room,
        roomAt: Date.now(),
      });
      return;
    }
    if (seat) local.set(seatKey(code), undefined); // Stale seat: fall back to a fresh join.
    set({ status: 'form', error: result.error.code });
  };

  /** Sends a team/battle action; stores the error code on failure. Returns success. */
  const act = async (send: (s: PlayerSocket) => Promise<{ ok: boolean; error?: ErrorPayload }>) => {
    if (!socket) return false;
    set({ busy: true, error: undefined, errorParams: undefined });
    const result = await send(socket);
    set({
      busy: false,
      ...(result.ok ? {} : { error: result.error?.code, errorParams: result.error?.params }),
    });
    return result.ok;
  };

  return {
    status: 'connecting',
    online: false,
    roomAt: 0,
    profile: initialProfile(),
    battle: null,
    busy: false,

    open: (rawCode) => {
      const code = rawCode.toUpperCase();
      const current = createPlayerSocket();
      socket = current;
      const hasSeat = Boolean(local.get<Seat>(seatKey(code)));
      set({ code, status: 'connecting', room: undefined, error: undefined, battle: null });

      current.on('connect', () => {
        set({ online: true });
        // Auto-rejoin on first connect (saved seat) and on every reconnect after joining.
        const { status } = get();
        if (status === 'joined' || (status === 'connecting' && hasSeat)) void sendJoin();
        else if (status === 'connecting') set({ status: 'form' });
      });
      current.on('disconnect', () => set({ online: false }));
      current.on('connect_error', () => set({ online: false }));
      current.on('room:state', (room) => {
        // Leaving the battle phase forgets the old battle menu.
        const battle = room.phase === 'BATTLE' ? get().battle : null;
        set({ room, roomAt: Date.now(), battle });
      });
      current.on('team:state', (team) => set({ team }));
      current.on('battle:request', (payload) => {
        const previous = get().battle?.request;
        const fresh = payload.request && payload.request.rqid !== previous?.rqid;
        if (fresh && payload.request?.kind !== 'wait' && !payload.choice) buzz();
        // A teammate's choice re-sends this menu (Mega lock); if it was sent before the server
        // got our own choice, keep the choice that is still waiting for its ack.
        const sending = pendingChoice?.rqid === payload.request?.rqid ? pendingChoice : null;
        set({
          battle: sending && !payload.choice ? { ...payload, choice: sending.choice } : payload,
        });
      });
      current.on('battle:waiting', (waiting) =>
        set({ waiting: { ...waiting, receivedAt: Date.now() } }),
      );
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
      await act((s) => s.emitWithAck('player:switchTeam', { team }));
    },

    leave: async () => {
      const { code } = get();
      if (!code) return;
      if (!(await act((s) => s.emitWithAck('player:leave', {})))) return;
      local.set(seatKey(code), undefined);
      set({ status: 'form', room: undefined, playerId: undefined, team: undefined });
    },

    randomize: async (slots) => {
      await act((s) => s.emitWithAck('team:randomize', slots ? { slots } : {}));
    },
    clearSlot: async (slot) => {
      await act((s) => s.emitWithAck('team:setSlot', { slot, set: null }));
    },
    saveSlot: async (slot, pokemon) =>
      act((s) => s.emitWithAck('team:setSlot', { slot, set: pokemon })),
    importTeam: async (text) => {
      let counts: TeamImportResult | null = null;
      await act(async (s) => {
        const result = await s.emitWithAck('team:import', { text });
        if (result.ok) counts = { count: result.count, skipped: result.skipped };
        return result;
      });
      return counts;
    },
    randomSet: async (species) => {
      let set: PokemonSetData | null = null;
      await act(async (s) => {
        const result = await s.emitWithAck('builder:randomSet', { species });
        if (result.ok) set = result.set;
        return result;
      });
      return set;
    },
    setReady: async (ready) => {
      await act((s) => s.emitWithAck('player:ready', { ready }));
    },

    choose: async (choice) => {
      const battle = get().battle;
      const request = battle?.request;
      if (!battle || !request) return;
      // Optimistic: show the waiting view right away (UI must react < 200 ms).
      set({ battle: { ...battle, choice } });
      pendingChoice = { rqid: request.rqid, choice };
      const ok = await act((s) => s.emitWithAck('battle:choose', { choice, rqid: request.rqid }));
      pendingChoice = null;
      const now = get().battle;
      if (!ok && now?.request?.rqid === request.rqid) set({ battle: { ...now, choice: null } });
    },
    undo: async () => {
      const battle = get().battle;
      if (!battle) return;
      if (await act((s) => s.emitWithAck('battle:undo', {}))) {
        const now = get().battle;
        if (now) set({ battle: { ...now, choice: null } });
      }
    },
    forfeit: async () => {
      await act((s) => s.emitWithAck('battle:forfeit', {}));
    },
    clearError: () => set({ error: undefined, errorParams: undefined }),
  };
});
