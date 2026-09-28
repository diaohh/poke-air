/**
 * Token bucket per key (client IP): `capacity` requests in a burst, refilled at
 * `refillPerSecond`. In-memory, one process — enough for the free single-instance deployment.
 */
export interface RateLimitOptions {
  capacity: number;
  refillPerSecond: number;
  now?: () => number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly now: () => number;

  constructor(private readonly options: RateLimitOptions) {
    this.now = options.now ?? Date.now;
  }

  /** Consumes one token for `key`. `false` = over the limit. */
  take(key: string): boolean {
    const now = this.now();
    const { capacity, refillPerSecond } = this.options;
    const bucket = this.buckets.get(key) ?? { tokens: capacity, updatedAt: now };
    bucket.tokens = Math.min(
      capacity,
      bucket.tokens + ((now - bucket.updatedAt) / 1000) * refillPerSecond,
    );
    bucket.updatedAt = now;
    this.buckets.set(key, bucket);
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  /** Drops buckets that are full again (call periodically to bound memory). */
  prune(): void {
    const now = this.now();
    const { capacity, refillPerSecond } = this.options;
    for (const [key, bucket] of this.buckets) {
      const tokens = bucket.tokens + ((now - bucket.updatedAt) / 1000) * refillPerSecond;
      if (tokens >= capacity) this.buckets.delete(key);
    }
  }
}
