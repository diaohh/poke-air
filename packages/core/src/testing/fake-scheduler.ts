import type { Scheduler } from '../time.js';

interface Timer {
  id: number;
  at: number;
  callback: () => void;
}

export interface FakeScheduler extends Scheduler {
  /** Moves the clock forward, running every timer that becomes due (in order). */
  advance(ms: number): void;
  pending(): number;
}

/** Deterministic scheduler for tests: time only moves when `advance()` is called. */
export function createFakeScheduler(start = 1_000): FakeScheduler {
  let now = start;
  let nextId = 0;
  let timers: Timer[] = [];

  return {
    now: () => now,
    setTimeout(callback, ms) {
      const timer = { id: ++nextId, at: now + ms, callback };
      timers.push(timer);
      return () => {
        timers = timers.filter((t) => t !== timer);
      };
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = timers
          .filter((t) => t.at <= target)
          .sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        timers = timers.filter((t) => t !== due);
        now = due.at;
        due.callback();
      }
      now = target;
    },
    pending: () => timers.length,
  };
}
