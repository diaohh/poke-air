import {
  ACTIVE_PER_SIDE,
  ANIMATION_TIMEOUT_MS,
  BATTLE_COUNTDOWN_MS,
  SIDE_IDS,
  SIDE_TEAM,
  TURN_TIMER_DOUBLES_MS,
  TURN_TIMER_MS,
  type BattleLogPayload,
  type BattleRequestPayload,
  type BattleResult,
  type BattleWaiting,
  type MoveMeta,
  type PokemonSetData,
  type SideId,
} from '@poke-air/shared';
import { RoomError } from '../rooms/room-error.js';
import type { Room } from '../rooms/room.js';
import { systemScheduler, type Scheduler } from '../time.js';
import { BattleSession, type BattleEnd, type BattleSideSummary } from './battle-session.js';
import { effectsIn } from './effects.js';
import { OwnershipLayer, type PublicField } from './ownership.js';
import {
  battleName,
  enrichRequest,
  moveMeta,
  type RawRequest,
  type SideRequest,
} from './request.js';
import { BATTLE_FORMAT_IDS } from './showdown.js';
import { TurnTimer } from './turn-timer.js';

export interface MatchTimings {
  countdownMs: number;
  turnTimerMs: number;
  /** Turn timer in doubles (two positions per player, decision D-49). */
  doublesTurnTimerMs: number;
  animationTimeoutMs: number;
}

export const DEFAULT_MATCH_TIMINGS: MatchTimings = {
  countdownMs: BATTLE_COUNTDOWN_MS,
  turnTimerMs: TURN_TIMER_MS,
  doublesTurnTimerMs: TURN_TIMER_DOUBLES_MS,
  animationTimeoutMs: ANIMATION_TIMEOUT_MS,
};

/** Transport-agnostic outputs; the server turns each into socket emits. */
export interface MatchListener {
  /** The public room state changed on its own (countdown started, battle started/ended). */
  roomChanged(): void;
  /** New public log lines → Host. */
  battleLog(payload: BattleLogPayload): void;
  /** What one phone has to choose now. */
  request(playerId: string, payload: BattleRequestPayload): void;
  /** Who is still choosing + timer → Host and phones. */
  waiting(payload: BattleWaiting): void;
}

export interface MatchDeps {
  scheduler?: Scheduler;
  timings?: Partial<MatchTimings>;
  /** PRNG seed per battle (tests); the sim picks a random one by default. */
  seed?: () => string | undefined;
  onError?: (error: unknown) => void;
}

/** One side's current decision point. */
interface Decision {
  request: SideRequest;
  /** Public view of the field when the request arrived (targets on the phones). */
  field: PublicField;
  /** Spectator log length when the request arrived: phones see it once the Host animated that far. */
  releaseAt: number;
  released: boolean;
  /** Each participant's part of the choice: one action per position they decide. */
  parts: Map<string, string[]>;
  /** The merged side choice was accepted by the sim (the side waits for the other one). */
  sent: boolean;
}

interface PendingEnd {
  end: BattleEnd;
  releaseAt: number;
  summary: Record<SideId, BattleSideSummary>;
  turns: number;
}

/**
 * Runs the battle part of one room: the automatic start countdown (decision D-21), the
 * `BattleSession`, Host ↔ phone animation sync (decision O-09), the turn timer and the end of the
 * battle. Game rules stay here; the server only forwards events.
 */
export class MatchController {
  private readonly scheduler: Scheduler;
  private readonly timings: MatchTimings;
  private readonly turnTimer: TurnTimer;

  private session: BattleSession | null = null;
  private ownership: OwnershipLayer | null = null;
  /** Every Pokémon's set by side and sim name: nature + Stat Points for its owner (D-34). */
  private sets: Record<SideId, Map<string, PokemonSetData>> = { p1: new Map(), p2: new Map() };
  private decisions: Partial<Record<SideId, Decision>> = {};
  private activePerSide = 1;
  private animatedUpTo = 0;
  private pendingEnd: PendingEnd | null = null;
  private cancelCountdown: (() => void) | null = null;
  private cancelRelease: (() => void) | null = null;
  private cancelEnd: (() => void) | null = null;
  private lastWaiting = '';

  constructor(
    private readonly room: Room,
    private readonly listener: MatchListener,
    private readonly deps: MatchDeps = {},
  ) {
    this.scheduler = deps.scheduler ?? systemScheduler;
    this.timings = { ...DEFAULT_MATCH_TIMINGS, ...deps.timings };
    this.turnTimer = new TurnTimer(this.scheduler, this.timings.turnTimerMs, () =>
      this.onTurnTimeout(),
    );
  }

  /**
   * Re-evaluates the room after any change (ready flags, teams, Host connection, phase):
   * starts or cancels the countdown and releases requests if the Host went away.
   */
  sync(): void {
    if (this.room.phase === 'TEAM_BUILDING' && this.room.allReady()) this.startCountdown();
    else this.stopCountdown();

    if (this.session) {
      this.releaseRequests();
      this.tryFinish();
    }
  }

  get inBattle(): boolean {
    return this.session !== null;
  }

  // ── Phone actions ────────────────────────────────────────────────

  choose(playerId: string, choice: string, rqid?: number): void {
    const { side, decision, session, ownership } = this.requireDecision(playerId);
    if (rqid !== undefined && rqid !== decision.request.rqid) throw new RoomError('STALE_REQUEST');
    if (decision.request.kind === 'wait') throw new RoomError('NO_PENDING_REQUEST');
    if (decision.sent || decision.parts.has(playerId)) throw new RoomError('ALREADY_CHOSEN');

    const actions = ownership.parsePart(
      playerId,
      decision.request,
      choice,
      decision.parts,
      decision.field,
    );
    decision.parts.set(playerId, actions);
    const merged = ownership.merge(decision.request, decision.parts);
    if (merged !== null) {
      decision.sent = true;
      // May resolve the turn synchronously: new decisions then replace this one.
      if (!session.choose(side, merged)) {
        decision.sent = false;
        decision.parts.delete(playerId);
        throw new RoomError('INVALID_CHOICE');
      }
    }
    this.emitTeammates(side, playerId, decision);
    this.afterDecisionChange();
  }

  undo(playerId: string): void {
    const { side, decision, session } = this.requireDecision(playerId);
    if (!decision.parts.has(playerId)) throw new RoomError('CANT_UNDO');
    if (decision.sent && !session.undo(side)) throw new RoomError('CANT_UNDO');
    decision.sent = false;
    decision.parts.delete(playerId);
    this.emitTeammates(side, playerId, decision);
    this.afterDecisionChange();
  }

  forfeit(playerId: string): void {
    const session = this.session;
    const side = this.ownership?.sideOf(playerId);
    if (!session || this.pendingEnd || !side) throw new RoomError('NO_ACTIVE_BATTLE');
    session.forfeit(side);
  }

  // ── Host ─────────────────────────────────────────────────────────

  /** The Host finished animating `upTo` log lines. */
  hostAnimated(upTo: number): void {
    if (!this.session) return;
    this.animatedUpTo = Math.max(this.animatedUpTo, upTo);
    this.releaseRequests();
    this.tryFinish();
  }

  /** Whole log for a Host that (re)attaches mid-battle; `null` when no battle runs. */
  resyncLog(): BattleLogPayload | null {
    if (!this.session) return null;
    const lines = [...this.session.spectatorLog];
    return { from: 0, lines, moves: movesIn(lines), effects: effectsIn(lines), resync: true };
  }

  // ── Queries (rejoin) ─────────────────────────────────────────────

  requestFor(playerId: string): BattleRequestPayload {
    const side = this.ownership?.sideOf(playerId);
    const decision = side && this.decisions[side];
    if (!this.ownership || !decision?.released) return { request: null, choice: null };
    return {
      request: this.ownership.requestFor(
        playerId,
        decision.request,
        decision.parts,
        decision.field,
      ),
      choice: decision.parts.get(playerId)?.join(', ') ?? null,
    };
  }

  waiting(): BattleWaiting {
    const waitingFor = this.waitingSides().flatMap((side) => {
      const decision = this.decisions[side];
      if (!decision || !this.ownership) return [];
      return this.ownership.participants(decision.request).filter((id) => !decision.parts.has(id));
    });
    return { waitingFor, timerMs: this.turnTimer.remainingMs() };
  }

  destroy(): void {
    this.stopCountdown();
    this.teardown();
  }

  // ── Countdown → battle start ─────────────────────────────────────

  private startCountdown(): void {
    if (this.cancelCountdown) return;
    this.room.setCountdown(this.scheduler.now() + this.timings.countdownMs);
    this.cancelCountdown = this.scheduler.setTimeout(() => {
      this.cancelCountdown = null;
      this.beginBattle();
    }, this.timings.countdownMs);
  }

  private stopCountdown(): void {
    if (!this.cancelCountdown) return;
    this.cancelCountdown();
    this.cancelCountdown = null;
    this.room.setCountdown(null);
  }

  private beginBattle(): void {
    if (!this.room.allReady()) {
      this.room.setCountdown(null);
      this.listener.roomChanged();
      return;
    }
    const sides = this.room.battleSides();
    this.room.startBattle();
    // Mega budget per team = players on the larger team, split evenly (1v2: the solo player gets 2).
    const larger = Math.max(sides.p1.players.length, sides.p2.players.length);
    const ownersOf = (side: SideId) =>
      sides[side].players.map((p) => ({
        playerId: p.playerId,
        pokemon: p.sets.map(battleName),
        megas: Math.floor(larger / Math.max(1, sides[side].players.length)),
      }));
    this.ownership = new OwnershipLayer({ p1: ownersOf('p1'), p2: ownersOf('p2') });
    this.activePerSide = ACTIVE_PER_SIDE[this.room.gameType];
    this.turnTimer.setDuration(
      this.room.gameType === 'doubles' ? this.timings.doublesTurnTimerMs : this.timings.turnTimerMs,
    );
    this.decisions = {};
    this.animatedUpTo = 0;
    this.lastWaiting = '';
    for (const side of SIDE_IDS) {
      // Keyed by the sim's name for the Pokémon (formes use their base species name).
      this.sets[side] = new Map(
        sides[side].players.flatMap((p) => p.sets.map((set) => [battleName(set), set])),
      );
    }

    const input = (side: SideId) => {
      const setup = sides[side];
      const first = setup.players[0] && this.room.getPlayer(setup.players[0].playerId);
      // Every player's first Pokémon leads (2v2: first-joined player on the left, decision D-46).
      const teams = setup.players.map((p) => p.sets);
      return {
        name: setup.name,
        ...(first ? { avatar: first.avatar } : {}),
        team: [...teams.flatMap((sets) => sets.slice(0, 1)), ...teams.flatMap((s) => s.slice(1))],
      };
    };
    const seed = this.deps.seed?.();
    this.session = new BattleSession({
      formatId: BATTLE_FORMAT_IDS[this.room.gameType],
      ...(seed ? { seed } : {}),
      sides: { p1: input('p1'), p2: input('p2') },
      onSpectator: (lines) => this.onSpectator(lines),
      onRequest: (side, request, rqid) => this.onRequest(side, request, rqid),
      onEnd: (end) => this.onEnd(end),
      ...(this.deps.onError ? { onError: this.deps.onError } : {}),
    });
    // Phase first, so every screen switches to the battle before the first log chunk arrives.
    this.listener.roomChanged();
    this.session.start();
  }

  // ── Session callbacks ────────────────────────────────────────────

  private onSpectator(lines: string[]): void {
    if (!this.session || lines.length === 0) return;
    // Mega quota: charged to the owner of the Pokémon that Mega Evolved (decision D-45).
    for (const line of lines) {
      const mega = /^\|-mega\|(p[12])[a-c]?: ([^|]+)/.exec(line);
      if (mega) this.ownership?.recordMega(mega[1] as SideId, mega[2] ?? '');
    }
    const from = this.session.spectatorLog.length - lines.length;
    this.listener.battleLog({ from, lines, moves: movesIn(lines), effects: effectsIn(lines) });
  }

  private onRequest(side: SideId, raw: RawRequest, rqid: number): void {
    const session = this.session;
    const ownership = this.ownership;
    if (!session || !ownership) return;
    const sets = this.sets[side];
    const request = enrichRequest(raw, rqid, {
      activePerSide: this.activePerSide,
      setOf: (name) => sets.get(name),
      boosts: session.activeBoosts(side),
    });
    const field = session.publicField();
    const previous = this.decisions[side];

    if (raw.update && previous && previous.request.rqid === rqid) {
      // Same decision with refreshed flags (hidden info revealed, undo): keep its release state.
      this.decisions[side] = { ...previous, request, field, parts: new Map(), sent: false };
      if (previous.released) this.emitRequest(side);
      this.afterDecisionChange();
      return;
    }

    this.decisions[side] = {
      request,
      field,
      releaseAt: session.spectatorLog.length,
      released: false,
      parts: new Map(),
      sent: false,
    };
    // A new decision point: the previous fallback no longer applies. Phones watch the screen
    // until the Host has animated what led here.
    this.cancelRelease?.();
    this.cancelRelease = null;
    for (const owner of ownership.ownersOf(side)) {
      this.listener.request(owner, { request: null, choice: null });
    }
    this.releaseRequests();
  }

  private onEnd(end: BattleEnd): void {
    const session = this.session;
    if (!session || this.pendingEnd) return;
    this.pendingEnd = {
      end,
      releaseAt: session.spectatorLog.length,
      summary: session.summary(),
      turns: session.turn,
    };
    this.decisions = {};
    this.turnTimer.stop();
    this.cancelRelease?.();
    this.cancelRelease = null;
    this.afterDecisionChange();
    if (!this.tryFinish()) {
      this.cancelEnd = this.scheduler.setTimeout(() => {
        this.cancelEnd = null;
        this.finish();
      }, this.timings.animationTimeoutMs);
    }
  }

  // ── Animation gating ─────────────────────────────────────────────

  /** Releases every request the Host has caught up with (all of them if the Host is offline). */
  private releaseRequests(): void {
    let pending = false;
    for (const side of SIDE_IDS) {
      const decision = this.decisions[side];
      if (!decision || decision.released) continue;
      if (!this.room.hostConnected || this.animatedUpTo >= decision.releaseAt) {
        decision.released = true;
        this.emitRequest(side);
      } else {
        pending = true;
      }
    }

    if (pending && !this.cancelRelease) {
      // A slow or frozen Host must never block the game.
      this.cancelRelease = this.scheduler.setTimeout(() => {
        this.cancelRelease = null;
        for (const side of SIDE_IDS) {
          const decision = this.decisions[side];
          if (decision && !decision.released) {
            decision.released = true;
            this.emitRequest(side);
          }
        }
        this.afterDecisionChange();
      }, this.timings.animationTimeoutMs);
    } else if (!pending) {
      this.cancelRelease?.();
      this.cancelRelease = null;
    }
    this.afterDecisionChange();
  }

  private emitRequest(side: SideId): void {
    for (const owner of this.ownership?.ownersOf(side) ?? []) {
      this.listener.request(owner, this.requestFor(owner));
    }
  }

  /**
   * A player's part changed: their teammates' menus refresh (the ally Mega lock, `allyMega`).
   * Skipped when the turn already resolved (the decision was replaced).
   */
  private emitTeammates(side: SideId, playerId: string, decision: Decision): void {
    if (this.decisions[side] !== decision || !decision.released) return;
    for (const owner of this.ownership?.ownersOf(side) ?? []) {
      if (owner !== playerId) this.listener.request(owner, this.requestFor(owner));
    }
  }

  // ── Turn timer ───────────────────────────────────────────────────

  /** Sides whose released, actionable request still lacks a sent choice. */
  private waitingSides(): SideId[] {
    return SIDE_IDS.filter((side) => {
      const decision = this.decisions[side];
      return decision?.released && decision.request.kind !== 'wait' && !decision.sent;
    });
  }

  private afterDecisionChange(): void {
    if (this.waitingSides().length > 0) this.turnTimer.ensureRunning();
    else this.turnTimer.stop();

    const waiting = this.waiting();
    const key = `${waiting.waitingFor.join(',')}|${waiting.timerMs === null}`;
    if (key === this.lastWaiting) return;
    this.lastWaiting = key;
    this.listener.waiting(waiting);
  }

  /**
   * Auto-completes every missing part with automatic actions (never a Mega); the parts teammates
   * already chose are kept.
   */
  private onTurnTimeout(): void {
    const session = this.session;
    const ownership = this.ownership;
    if (!session || !ownership) return;
    for (const side of this.waitingSides()) {
      const decision = this.decisions[side];
      if (!decision) continue;
      for (const playerId of ownership.participants(decision.request)) {
        if (!decision.parts.has(playerId)) {
          decision.parts.set(
            playerId,
            ownership.defaultPart(playerId, decision.request, decision.field),
          );
        }
      }
      const merged = ownership.merge(decision.request, decision.parts);
      if (merged === null) continue;
      decision.sent = true;
      if (!session.choose(side, merged)) {
        // A rejected merge (an unexpected edge case): let the sim pick for the whole side.
        session.choose(side, 'default');
      }
      // Phones that were still choosing must leave their menu.
      if (this.decisions[side] === decision) this.emitRequest(side);
    }
    this.afterDecisionChange();
  }

  // ── Battle end ───────────────────────────────────────────────────

  /** Moves to RESULTS once the Host has shown the final blow (or the Host is gone). */
  private tryFinish(): boolean {
    const pending = this.pendingEnd;
    if (!pending) return false;
    if (this.room.hostConnected && this.animatedUpTo < pending.releaseAt) return false;
    this.finish();
    return true;
  }

  private finish(): void {
    const pending = this.pendingEnd;
    if (!pending || this.room.phase !== 'BATTLE') return;
    const { end, summary, turns } = pending;
    const result: BattleResult = {
      winner: end.winner ? SIDE_TEAM[end.winner] : null,
      reason: end.reason,
      turns,
      teams: {
        red: { kos: summary.p2.fainted, remaining: summary.p1.remaining, total: summary.p1.total },
        blue: { kos: summary.p1.fainted, remaining: summary.p2.remaining, total: summary.p2.total },
      },
    };
    this.teardown();
    this.room.finishBattle(result);
    this.listener.roomChanged();
  }

  private teardown(): void {
    this.turnTimer.stop();
    this.cancelRelease?.();
    this.cancelEnd?.();
    this.cancelRelease = null;
    this.cancelEnd = null;
    const session = this.session;
    this.session = null;
    this.ownership = null;
    this.decisions = {};
    this.pendingEnd = null;
    this.animatedUpTo = 0;
    this.lastWaiting = '';
    // Teardown can run inside a sim callback: free the battle once that call has returned.
    if (session) this.scheduler.setTimeout(() => session.destroy(), 0);
  }

  private requireDecision(playerId: string) {
    const session = this.session;
    const ownership = this.ownership;
    if (!session || !ownership || this.pendingEnd) throw new RoomError('NO_ACTIVE_BATTLE');
    const side = ownership.sideOf(playerId);
    const decision = side && this.decisions[side];
    if (!side || !decision?.released) throw new RoomError('NO_PENDING_REQUEST');
    return { side, decision, session, ownership };
  }
}

/** Public type/category of the moves used in these lines (`|move|<user>|<Move>|…`). */
function movesIn(lines: readonly string[]): Record<string, MoveMeta> {
  const moves: Record<string, MoveMeta> = {};
  for (const line of lines) {
    if (!line.startsWith('|move|')) continue;
    const name = line.split('|')[3];
    if (name && !moves[name]) moves[name] = moveMeta(name);
  }
  return moves;
}
