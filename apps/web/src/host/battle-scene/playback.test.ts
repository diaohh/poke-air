import { describe, expect, it } from 'vitest';
import { BattlePlayback, type PlaybackFrame } from './playback';

const START = [
  '|player|p1|Ana||',
  '|player|p2|Ben||',
  '|teamsize|p1|1',
  '|teamsize|p2|1',
  '|start',
  '|switch|p1a: Garchomp|Garchomp, L50|100/100',
  '|switch|p2a: Magikarp|Magikarp, L50|100/100',
  '|turn|1',
];
const TURN = [
  '|move|p1a: Garchomp|Earthquake|p2a: Magikarp',
  '|-damage|p2a: Magikarp|0 fnt',
  '|faint|p2a: Magikarp',
  '|win|Ana',
];

/** Manual timers: `tick()` fires the pending one. */
function setup() {
  const frames: PlaybackFrame[] = [];
  const caughtUp: number[] = [];
  let pending: (() => void) | null = null;
  const playback = new BattlePlayback({
    onFrame: (frame) => frames.push(frame),
    onCaughtUp: (upTo) => caughtUp.push(upTo),
    setTimer: (callback) => {
      pending = callback;
      return () => {
        pending = null;
      };
    },
  });
  const tick = () => {
    const run = pending;
    pending = null;
    run?.();
  };
  return { playback, frames, caughtUp, tick, hasTimer: () => pending !== null };
}

describe('BattlePlayback', () => {
  it('plays one event at a time and reports when it has caught up', () => {
    const { playback, frames, caughtUp, tick } = setup();
    playback.reset(START, false);
    expect(frames.at(-1)?.event?.kind).toBe('switch');
    expect(caughtUp).toEqual([]);

    tick(); // second switch-in
    expect(frames.at(-1)?.messages.map((m) => m.key)).toEqual(['sentOut', 'sentOut']);
    tick(); // turn marker
    tick();
    expect(caughtUp).toEqual([START.length]);

    playback.feed([...START, ...TURN]);
    expect(frames.at(-1)?.event).toMatchObject({ kind: 'move', move: 'Earthquake' });
    tick();
    tick();
    tick();
    tick();
    expect(frames.at(-1)?.scene.ended).toBe(true);
    expect(caughtUp.at(-1)).toBe(START.length + TURN.length);
  });

  it('jumps straight to the current state on resync', () => {
    const { playback, frames, caughtUp, hasTimer } = setup();
    playback.reset([...START, ...TURN], true);
    expect(frames).toHaveLength(1);
    expect(frames[0]?.scene.sides.p2.pokemon[0]?.fainted).toBe(true);
    expect(caughtUp).toEqual([START.length + TURN.length]);
    expect(hasTimer()).toBe(false);
  });

  it('builds the battle log by turn, never ahead of the animation', () => {
    const { playback, frames, tick } = setup();
    playback.reset([...START, ...TURN], false);
    const keys = () => frames.at(-1)?.log.map((t) => [t.turn, t.lines.map((l) => l.key)]);
    expect(keys()).toEqual([[0, ['sentOut']]]);

    for (let i = 0; i < 8; i++) tick();
    expect(keys()).toEqual([
      [0, ['sentOut', 'sentOut']],
      [1, ['used', 'fainted', 'won']],
    ]);
    const used = frames.at(-1)?.log[1]?.lines[0];
    expect(used).toMatchObject({ side: 'p1', params: { move: 'Earthquake' } });
  });

  it('rebuilds the whole battle log on resync', () => {
    const { playback, frames } = setup();
    playback.reset([...START, ...TURN], true);
    expect(frames[0]?.log.map((t) => t.lines.length)).toEqual([2, 3]);
    expect(frames[0]?.messages.map((m) => m.key)).toEqual(['fainted', 'won']);
  });

  it('skips the queued animations', () => {
    const { playback, caughtUp, hasTimer } = setup();
    playback.reset([...START, ...TURN], false);
    expect(hasTimer()).toBe(true);
    playback.skip();
    expect(hasTimer()).toBe(false);
    expect(caughtUp).toEqual([START.length + TURN.length]);
  });
});
