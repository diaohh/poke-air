import type { Scheduler } from '../time.js';

/** One countdown per decision point; `onExpire` auto-completes the missing choices. */
export class TurnTimer {
  private cancel: (() => void) | null = null;
  private deadline: number | null = null;

  constructor(
    private readonly scheduler: Scheduler,
    private durationMs: number,
    private readonly onExpire: () => void,
  ) {}

  get running(): boolean {
    return this.deadline !== null;
  }

  /** Duration of the next countdowns (the format decides it: 60 s singles, 90 s doubles). */
  setDuration(ms: number): void {
    this.durationMs = ms;
  }

  /** Starts the timer unless it is already running (it is not restarted). */
  ensureRunning(): void {
    if (this.running) return;
    this.deadline = this.scheduler.now() + this.durationMs;
    this.cancel = this.scheduler.setTimeout(() => {
      this.cancel = null;
      this.deadline = null;
      this.onExpire();
    }, this.durationMs);
  }

  stop(): void {
    this.cancel?.();
    this.cancel = null;
    this.deadline = null;
  }

  remainingMs(): number | null {
    return this.deadline === null ? null : Math.max(0, this.deadline - this.scheduler.now());
  }
}
