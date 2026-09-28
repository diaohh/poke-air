/* eslint-disable no-sparse-arrays -- ZzFX parameter lists use holes for defaults, exactly as the
   ZzFX designer exports them, so tuned sounds can be pasted back as-is. */
import type { EffectDuration, MoveCategory } from '@poke-air/shared';
import type { SceneEvent } from '../battle-scene/model';

/**
 * Host sound effects, synthesized at runtime with ZzFX (MIT): no audio files, retro "blip" style
 * that matches the pixel sprites (docs/03-data-sources-and-licensing.md § Audio). Each entry is a
 * ZzFX parameter list: [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve,
 * slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay,
 * sustainVolume, decay, tremolo]. Tune them with the ZzFX designer
 * (https://killedbyapixel.github.io/ZzFX/) and paste the array back.
 */
export const SFX = {
  // UI
  join: [, , 1675, , 0.06, 0.24, 1, 1.82, , , 837, 0.06],
  leave: [0.6, , 420, , 0.05, 0.16, 1, , -12],
  ready: [0.8, , 523, 0.02, 0.08, 0.2, 1, , , , 262, 0.07],
  tick: [0.5, , 880, , 0.02, 0.06, 1],
  go: [, , 660, 0.02, 0.2, 0.35, 1, , , , 330, 0.1],
  // Battle
  switchIn: [0.7, , 380, 0.01, 0.05, 0.14, 1, 2, 22],
  swing: [0.6, , 160, 0.02, 0.03, 0.14, 4, , , , , , , 1.4],
  beam: [0.5, , 640, 0.02, 0.18, 0.26, 2, , -6, , , , , 0.2],
  cast: [0.5, , 1200, 0.05, 0.18, 0.3, , , , , , , 0.07, , 5],
  hit: [0.9, , 90, , 0.03, 0.2, 4, 2, , , , , , 1],
  hitStrong: [1.2, , 70, , 0.05, 0.36, 4, 2.5, , , , , , 2, , 0.1],
  hitWeak: [0.5, , 130, , 0.02, 0.12, 4, 1, , , , , , 0.5],
  crit: [0.9, , 1000, , 0.03, 0.15, 3, , , , -400, 0.03, , 1.5],
  miss: [0.4, , 320, , 0.05, 0.12, , , -8],
  faint: [0.8, , 520, 0.05, 0.25, 0.6, 2, , -2, , , , , , , , 0.1],
  // Stat stages: voices for the rising / falling arpeggios in SEQUENCES (frequency is replaced).
  chime: [0.6, , 523, 0.01, 0.06, 0.14, 1],
  dip: [0.6, , 523, 0.01, 0.08, 0.16, 2, , -1],
  status: [0.6, , 200, 0.02, 0.2, 0.3, 2, , , , , , , , 20, , , , , 0.5],
  heal: [0.6, , 700, 0.02, 0.2, 0.3, , , , , 300, 0.08, 0.08],
  mega: [1, , 200, 0.1, 0.6, 0.8, 2, , 3, , , , 0.1, , 10, , , , , 0.2],
  // Ability call-out ("[Garchomp's Rough Skin]"): bright two-tone ding.
  ability: [0.7, , 880, 0.01, 0.05, 0.2, 1, , , , 440, 0.05],
  protect: [0.6, , 1500, 0.02, 0.2, 0.3, , , , , , , 0.04, , 8],
  cure: [0.6, , 900, 0.02, 0.1, 0.25, , , 6, , 200, 0.06],
  item: [0.6, , 1200, 0.01, 0.04, 0.12, 1, , , , 600, 0.04],
  // Field: weather / terrain / room effects, screens & Tailwind (timed), hazards, an effect ending.
  weather: [0.5, , 150, 0.2, 0.4, 0.5, 4, , , , , , , 0.8, , , , 0.6],
  field: [0.5, , 400, 0.1, 0.3, 0.4, , , 2, , , , 0.08, , 4],
  screen: [0.5, , 1000, 0.05, 0.2, 0.3, , , -1, , , , 0.05],
  hazard: [0.6, , 1800, , 0.02, 0.1, 3, , , , -900, 0.02, 0.05],
  fade: [0.4, , 500, 0.02, 0.1, 0.3, , , -3],
} satisfies Record<string, (number | undefined)[]>;

/** A melody: [frequency, delay ms] notes played with one of the SFX voices. */
interface Sequence {
  voice: keyof typeof SFX;
  notes: [number, number][];
}

/**
 * Multi-note effects. Stat stages follow the games' feel: a rising arpeggio for a raise, a falling
 * one for a drop, with one more note per stage (+1 / +2 / +3 or more).
 */
export const SEQUENCES = {
  // Victory jingle: C5 E5 G5 C6.
  fanfare: {
    voice: 'ready',
    notes: [
      [523, 0],
      [659, 140],
      [784, 280],
      [1047, 440],
    ],
  },
  statUp1: {
    voice: 'chime',
    notes: [
      [523, 0],
      [784, 90],
    ],
  },
  statUp2: {
    voice: 'chime',
    notes: [
      [523, 0],
      [659, 75],
      [784, 150],
    ],
  },
  statUp3: {
    voice: 'chime',
    notes: [
      [523, 0],
      [659, 65],
      [784, 130],
      [1047, 195],
    ],
  },
  statDown1: {
    voice: 'dip',
    notes: [
      [440, 0],
      [330, 100],
    ],
  },
  statDown2: {
    voice: 'dip',
    notes: [
      [523, 0],
      [415, 85],
      [330, 170],
    ],
  },
  statDown3: {
    voice: 'dip',
    notes: [
      [587, 0],
      [494, 75],
      [392, 150],
      [294, 225],
    ],
  },
} satisfies Record<string, Sequence>;

export type SfxName = keyof typeof SFX | keyof typeof SEQUENCES;

const HIT_MESSAGES = new Set(['superEffective', 'resisted', 'crit']);

/** "boost.2" → 2 (1–3). */
function stages(key: string | undefined): 1 | 2 | 3 {
  const size = Number(key?.split('.')[1]);
  return size >= 3 ? 3 : size === 2 ? 2 : 1;
}

/** Which sound an `effect` event (abilities, Protect, cures, items…) plays. */
function effectSfx(key: string | undefined): SfxName {
  switch (key) {
    case 'ability':
      return 'ability';
    case 'protected':
      return 'protect';
    case 'cured':
      return 'cure';
    case 'confused':
      return 'status';
    case 'itemEaten':
    case 'itemLost':
    case 'itemUsed':
    case 'itemRevealed':
    case 'itemObtained':
      return 'item';
    default:
      return 'cast';
  }
}

/**
 * Which effect a scene event plays. Showdown logs effectiveness / crit *before* the damage line,
 * so those messages carry the hit sound and the damage right after them stays silent.
 */
export function sfxForEvent(
  event: SceneEvent,
  category: MoveCategory | undefined,
  previous: SceneEvent | null,
  /** Dex durations from the log: timed side conditions (screens, Tailwind) vs hazards. */
  effects: Record<string, EffectDuration> = {},
): SfxName | null {
  const key = event.narration?.key;
  switch (event.kind) {
    case 'switch':
      return 'switchIn';
    case 'move':
      return category === 'Physical' ? 'swing' : category === 'Special' ? 'beam' : 'cast';
    case 'damage':
      if (previous?.kind === 'message' && HIT_MESSAGES.has(previous.narration?.key ?? '')) {
        return null;
      }
      // Residual damage (poison, weather, Life Orb…) is announced: a softer hit.
      return event.narration ? 'hitWeak' : 'hit';
    case 'message':
      switch (event.narration?.key) {
        case 'superEffective':
          return 'hitStrong';
        case 'resisted':
          return 'hitWeak';
        case 'crit':
          return 'crit';
        case 'missed':
        case 'failed':
        case 'immune':
          return 'miss';
        case 'weatherStart':
          return 'weather';
        case 'fieldStart':
          return 'field';
        case 'sideStart': {
          const effect = event.narration?.params?.effect;
          return typeof effect === 'string' && effects[effect] ? 'screen' : 'hazard';
        }
        case 'weatherEnd':
        case 'fieldEnd':
        case 'sideEnd':
          return 'fade';
        default:
          return key?.startsWith('weather.') ? 'weather' : null;
      }
    case 'heal':
      return 'heal';
    case 'faint':
      return 'faint';
    case 'mega':
      return 'mega';
    case 'status':
      return 'status';
    case 'boost':
      return `statUp${stages(key)}`;
    case 'unboost':
      return `statDown${stages(key)}`;
    case 'effect':
      return effectSfx(key);
    case 'end':
      return 'fanfare';
    default:
      return null;
  }
}
