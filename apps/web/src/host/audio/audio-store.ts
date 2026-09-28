import { create } from 'zustand';
import { local } from '../../lib/storage';

export interface AudioSettings {
  muted: boolean;
  /** 0–1. */
  music: number;
  /** 0–1. */
  effects: number;
  /** Pokémon cries (only when downloaded with `pnpm fetch:audio`). */
  cries: boolean;
}

interface AudioStore extends AudioSettings {
  /** Runtime status for the sound menu. `null` = not known yet. */
  criesAvailable: boolean | null;
  musicMissing: boolean;
  set: (changes: Partial<AudioSettings>) => void;
  setStatus: (status: Partial<Pick<AudioStore, 'criesAvailable' | 'musicMissing'>>) => void;
}

const KEY = 'audio';
const DEFAULTS: AudioSettings = { muted: false, music: 0.4, effects: 0.8, cries: true };

/** Host sound settings, remembered per browser (docs/12-design-system.md § Audio). */
export const useAudioStore = create<AudioStore>((set, get) => ({
  ...DEFAULTS,
  ...local.get<Partial<AudioSettings>>(KEY),
  criesAvailable: null,
  musicMissing: false,
  set: (changes) => {
    set(changes);
    const { muted, music, effects, cries } = get();
    local.set(KEY, { muted, music, effects, cries });
  },
  setStatus: (status) => set(status),
}));
