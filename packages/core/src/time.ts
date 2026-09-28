/**
 * Clock + timers, injectable so battle and countdown logic can be tested without waiting.
 * `setTimeout` returns a cancel function.
 */
export interface Scheduler {
  now(): number;
  setTimeout(callback: () => void, ms: number): () => void;
}

export const systemScheduler: Scheduler = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => {
    const handle = setTimeout(callback, ms);
    return () => clearTimeout(handle);
  },
};
