import { ZZFX, zzfx } from 'zzfx';
import { spriteCandidates } from '../../lib/pokemon-sprites';
import { useAudioStore } from './audio-store';
import { SEQUENCES, SFX, type SfxName } from './sounds';

/**
 * Host-only audio (the phones stay silent: everyone is in the same room). Browsers only allow
 * sound after a user gesture, so nothing plays until `unlockAudio()` runs (first click / key, or
 * the "Host a battle" click that opened this page).
 *
 * - Effects: synthesized with ZzFX (`sounds.ts`).
 * - Music: optional CC0 files in `/audio/music/{lobby,battle,victory}.mp3` (see
 *   `apps/web/public/audio/README.md`); missing files are simply skipped.
 * - Cries: optional, downloaded by `pnpm fetch:audio` (`/audio/cries-manifest.json`).
 */

let unlocked = false;
const settings = () => useAudioStore.getState();

export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  void ZZFX.audioContext.resume().catch(() => {});
  music.refresh();
}

/** The page already had a user gesture (e.g. the Home "Host a battle" click before navigating). */
export function hasUserActivation(): boolean {
  return Boolean(navigator.userActivation?.hasBeenActive);
}

// ── Effects ──────────────────────────────────────────────────────────

export function playSfx(name: SfxName): void {
  const { muted, effects } = settings();
  if (!unlocked || muted || effects <= 0) return;
  ZZFX.volume = 0.3 * effects;
  try {
    if (name in SEQUENCES) {
      const { voice, notes } = SEQUENCES[name as keyof typeof SEQUENCES];
      const [volume, randomness, , ...rest] = SFX[voice];
      for (const [frequency, delay] of notes) {
        setTimeout(() => zzfx(volume, randomness, frequency, ...rest), delay);
      }
    } else {
      zzfx(...SFX[name as keyof typeof SFX]);
    }
  } catch {
    // Audio is a nicety; never break the scene.
  }
}

// ── Music ────────────────────────────────────────────────────────────

export type Track = 'lobby' | 'battle' | 'victory';
const FADE_MS = 400;

class MusicPlayer {
  private wanted: Track | null = null;
  private current: { track: Track; el: HTMLAudioElement } | null = null;
  private readonly missing = new Set<Track>();

  /** Switches to `track` (crossfade). `null` = silence. */
  play(track: Track | null): void {
    this.wanted = track;
    if (this.current?.track === track) return;
    if (this.current) fadeOut(this.current.el);
    this.current = null;
    if (!track || this.missing.has(track)) return;

    const el = new Audio(`/audio/music/${track}.mp3`);
    el.loop = track !== 'victory';
    el.preload = 'auto';
    el.addEventListener('error', () => {
      this.missing.add(track);
      if (this.current?.el === el) this.current = null;
      useAudioStore.getState().setStatus({ musicMissing: true });
    });
    this.current = { track, el };
    this.refresh();
  }

  /** Applies mute/volume and (re)starts playback when allowed. */
  refresh(): void {
    const el = this.current?.el;
    if (!el) return;
    const { muted, music: volume } = settings();
    el.volume = Math.min(1, volume);
    if (!unlocked || muted || volume <= 0) el.pause();
    else if (el.paused && !el.ended) void el.play().catch(() => {});
  }

  get track(): Track | null {
    return this.wanted;
  }
}

function fadeOut(el: HTMLAudioElement): void {
  const start = el.volume;
  const steps = 8;
  let step = 0;
  const timer = setInterval(() => {
    step++;
    el.volume = Math.max(0, start * (1 - step / steps));
    if (step >= steps) {
      clearInterval(timer);
      el.pause();
    }
  }, FADE_MS / steps);
}

export const music = new MusicPlayer();

// Settings changes (menu) apply immediately.
useAudioStore.subscribe(() => music.refresh());

// ── Cries ────────────────────────────────────────────────────────────

let cries: Record<string, string> | null = null;
let criesLoading: Promise<void> | null = null;

function loadCries(): Promise<void> {
  criesLoading ??= fetch('/audio/cries-manifest.json')
    .then((response) => (response.ok ? (response.json() as Promise<Record<string, string>>) : {}))
    .catch(() => ({}))
    .then((data) => {
      cries = data;
      useAudioStore.getState().setStatus({ criesAvailable: Object.keys(data).length > 0 });
    });
  return criesLoading;
}
void loadCries();

/** Plays a species' cry (base forme as fallback). `pitch` < 1 = lower (faint). */
export function playCry(species: string, pitch = 1): void {
  const { muted, effects, cries: enabled } = settings();
  if (!unlocked || muted || !enabled || effects <= 0 || !cries) return;
  const src = spriteCandidates(species)
    .map((id) => cries?.[id])
    .find(Boolean);
  if (!src) return;
  const el = new Audio(src);
  el.volume = Math.min(1, effects * 0.7);
  el.preservesPitch = false;
  el.playbackRate = pitch;
  void el.play().catch(() => {});
}
