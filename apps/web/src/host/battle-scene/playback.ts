import type { SideId } from '@poke-air/shared';
import {
  applyLine,
  initialScene,
  type Narration,
  type SceneEvent,
  type SceneEventKind,
  type SceneState,
} from './model';

/** How long each event holds the screen (ms). Short on purpose: battles must not feel slow. */
export const EVENT_DURATION: Record<SceneEventKind, number> = {
  switch: 950,
  move: 800,
  damage: 750,
  heal: 650,
  faint: 950,
  mega: 1500,
  status: 800,
  boost: 650,
  unboost: 650,
  effect: 800,
  message: 850,
  turn: 300,
  end: 1500,
};

/** Turns kept in the battle log panel (older ones scroll away for good). */
const LOG_TURNS = 60;

/** A narration line with a unique id (React key, entrance animation). */
export interface NarrationLine extends Narration {
  id: number;
  /** Side the line is about (colors its dot in the battle log). */
  side?: SideId;
}

/** Battle log panel: narration grouped by turn (`turn: 0` = the lead switch-ins). */
export interface LogTurn {
  turn: number;
  lines: NarrationLine[];
}

export interface PlaybackFrame {
  scene: SceneState;
  event: SceneEvent | null;
  /** Increments per animated event, so the same kind of event twice still restarts its animation. */
  eventId: number;
  /** Latest narration lines, oldest first (max 2). */
  messages: NarrationLine[];
  /** Everything narrated so far — never ahead of the animation. */
  log: LogTurn[];
}

export interface PlaybackOptions {
  onFrame: (frame: PlaybackFrame) => void;
  /** Every line up to `upTo` has been shown (→ `host:animated`). */
  onCaughtUp: (upTo: number) => void;
  /** > 1 plays faster (tests, E2E). */
  speed?: number;
  setTimer?: (callback: () => void, ms: number) => () => void;
}

const defaultTimer = (callback: () => void, ms: number) => {
  const handle = setTimeout(callback, ms);
  return () => clearTimeout(handle);
};

/**
 * AnimationQueue for the Host: plays the spectator log one event at a time. Lines without a
 * visible event are applied instantly. Game logic never waits for this (the server has a
 * fallback timeout); only the phones' next menu does.
 */
export class BattlePlayback {
  private lines: readonly string[] = [];
  private played = 0;
  private scene: SceneState = initialScene();
  private eventId = 0;
  private lineId = 0;
  private messages: NarrationLine[] = [];
  private log: LogTurn[] = [];
  private cancelTimer: (() => void) | null = null;
  private readonly setTimer: NonNullable<PlaybackOptions['setTimer']>;

  constructor(private readonly options: PlaybackOptions) {
    this.setTimer = options.setTimer ?? defaultTimer;
  }

  /**
   * Starts over with a new log. `resync` (Host refresh mid-battle): jump straight to the current
   * state (log panel included) without animating the past.
   */
  reset(lines: readonly string[], resync: boolean): void {
    this.stop();
    this.lines = lines;
    this.scene = initialScene();
    this.played = 0;
    this.eventId = 0;
    this.lineId = 0;
    this.messages = [];
    this.log = [];
    if (resync) this.skip(true);
    else this.step();
  }

  /** The log grew (append-only). */
  feed(lines: readonly string[]): void {
    this.lines = lines;
    if (!this.cancelTimer) this.step();
  }

  /** Fast-forwards everything queued (Host "skip" key). */
  skip(force = false): void {
    if (!force && this.played >= this.lines.length) return;
    this.stop();
    while (this.played < this.lines.length) this.apply();
    this.emit(null);
    this.options.onCaughtUp(this.played);
  }

  destroy(): void {
    this.stop();
  }

  private step(): void {
    while (this.played < this.lines.length) {
      const event = this.apply();
      const duration = event ? EVENT_DURATION[event.kind] / (this.options.speed ?? 1) : 0;
      if (event && duration > 0) {
        this.eventId++;
        this.emit(event);
        this.cancelTimer = this.setTimer(() => {
          this.cancelTimer = null;
          this.step();
        }, duration);
        return;
      }
    }
    this.emit(null);
    this.options.onCaughtUp(this.played);
  }

  /** Applies the next line and records its narration (narration box + log panel). */
  private apply(): SceneEvent | null {
    const { state, event } = applyLine(this.scene, this.lines[this.played++] ?? '');
    this.scene = state;
    if (event?.kind === 'turn') {
      this.log = [...this.log, { turn: state.turn, lines: [] }].slice(-LOG_TURNS);
    } else if (event?.narration) {
      const line: NarrationLine = {
        ...event.narration,
        id: ++this.lineId,
        ...(event.side ? { side: event.side } : {}),
      };
      this.messages = [...this.messages, line].slice(-2);
      // Lines before `|turn|1` (lead switch-ins) go to an implicit turn-0 group.
      const last = this.log.at(-1);
      this.log = last
        ? [...this.log.slice(0, -1), { ...last, lines: [...last.lines, line] }]
        : [{ turn: 0, lines: [line] }];
    }
    return event;
  }

  private stop(): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
  }

  private emit(event: SceneEvent | null): void {
    this.options.onFrame({
      scene: this.scene,
      event,
      eventId: this.eventId,
      messages: this.messages,
      log: this.log,
    });
  }
}
