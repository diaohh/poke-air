import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limit.js';

describe('RateLimiter', () => {
  it('allows a burst, then refills over time, per key', () => {
    let now = 0;
    const limiter = new RateLimiter({ capacity: 2, refillPerSecond: 1, now: () => now });
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
    expect(limiter.take('b')).toBe(true);

    now = 999;
    expect(limiter.take('a')).toBe(false);
    now = 2_000;
    expect(limiter.take('a')).toBe(true);
  });

  it('prunes buckets that are full again', () => {
    let now = 0;
    const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 1, now: () => now });
    limiter.take('a');
    now = 5_000;
    limiter.prune();
    expect(limiter.take('a')).toBe(true);
  });
});
