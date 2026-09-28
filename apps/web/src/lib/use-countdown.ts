import { useEffect, useState } from 'react';

/**
 * Counts down locally from a server-sent remaining time (`remainingMs` measured at `receivedAt`).
 * Servers send durations instead of deadlines, so device clock skew doesn't matter.
 * Returns whole seconds left (rounded up), or `null` when there is no timer.
 */
export function useCountdown(remainingMs: number | null | undefined, receivedAt: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (remainingMs == null) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [remainingMs, receivedAt]);

  if (remainingMs == null) return null;
  const left = remainingMs - (Math.max(now, receivedAt) - receivedAt);
  return Math.max(0, Math.ceil(left / 1000));
}

/** 75 → "1:15" */
export function formatSeconds(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
