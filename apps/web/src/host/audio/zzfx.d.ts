// Minimal types for `zzfx` (MIT, https://github.com/KilledByAPixel/ZzFX), which ships plain JS.
declare module 'zzfx' {
  /** Parameters: volume, randomness, frequency, attack, sustain, release, shape, … (see ZzFX docs). */
  export function zzfx(...parameters: (number | undefined)[]): AudioBufferSourceNode;
  export const ZZFX: {
    /** Master volume scale (default 0.3). */
    volume: number;
    audioContext: AudioContext;
  };
}
