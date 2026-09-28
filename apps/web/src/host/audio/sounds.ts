/* eslint-disable no-sparse-arrays -- ZzFX parameter lists use holes for defaults, exactly as the
   ZzFX designer exports them, so tuned sounds can be pasted back as-is. */
import type { MoveCategory } from '@poke-air/shared';
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
  statUp: [0.6, , 300, 0.02, 0.15, 0.2, , , 4, , , , 0.06],
  statDown: [0.6, , 600, 0.02, 0.15, 0.2, , , -4, , , , 0.06],
  status: [0.6, , 200, 0.02, 0.2, 0.3, 2, , , , , , , , 20, , , , , 0.5],
  heal: [0.6, , 700, 0.02, 0.2, 0.3, , , , , 300, 0.08, 0.08],
  mega: [1, , 200, 0.1, 0.6, 0.8, 2, , 3, , , , 0.1, , 10, , , , , 0.2],
} satisfies Record<string, (number | undefined)[]>;

export type SfxName = keyof typeof SFX | 'fanfare';

/** Victory jingle: [frequency, delay ms] notes (C5 E5 G5 C6), played with the `ready` voice. */
export const FANFARE: [number, number][] = [
  [523, 0],
  [659, 140],
  [784, 280],
  [1047, 440],
];

const HIT_MESSAGES = new Set(['superEffective', 'resisted', 'crit']);

/**
 * Which effect a scene event plays. Showdown logs effectiveness / crit *before* the damage line,
 * so those messages carry the hit sound and the damage right after them stays silent.
 */
export function sfxForEvent(
  event: SceneEvent,
  category: MoveCategory | undefined,
  previous: SceneEvent | null,
): SfxName | null {
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
        default:
          return null;
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
      return 'statUp';
    case 'unboost':
      return 'statDown';
    case 'effect':
      return 'cast';
    case 'end':
      return 'fanfare';
    default:
      return null;
  }
}
