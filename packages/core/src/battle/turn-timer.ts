import type { Scheduler } from '../time.js';

/** One countdown per decision point; `onExpire` auto-completes the missing choices. */
export class TurnTimer {
  private cancel: (() => void) | null = null;
  private deadline: number | null = null;

  constructor(
    private readonly scheduler: Scheduler,
    private readonly durationMs: number,
    private readonly onExpire: () => void,
  ) {}

  get running(): boolean {
    return this.deadline !== null;
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
