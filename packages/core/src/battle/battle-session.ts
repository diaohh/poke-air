import {
  SIDE_IDS,
  type BattleEndReason,
  type BoostId,
  type PokemonSetData,
  type SideId,
} from '@poke-air/shared';
import { TeamService } from '../team/team-service.js';
import type { RawRequest } from './request.js';
import { Battle, type ShowdownBattle } from './showdown.js';

export interface BattleSideInput {
  name: string;
  avatar?: string;
  team: PokemonSetData[];
}

export interface BattleEnd {
  winner: SideId | null;
  reason: BattleEndReason;
}

export interface BattleSideSummary {
  /** Pokémon of this side that fainted. */
  fainted: number;
  remaining: number;
  total: number;
}

export interface BattleSessionOptions {
  formatId: string;
  /** PRNG seed (e.g. "sodium,<hex>"): fixed in tests for deterministic battles. */
  seed?: string;
  sides: Record<SideId, BattleSideInput>;
  /** Public log chunk (what a spectator sees) → Host. */
  onSpectator?: (lines: string[]) => void;
  /** New (or updated) request for a side. `wait: true` requests are forwarded too. */
  onRequest?: (side: SideId, request: RawRequest, rqid: number) => void;
  onEnd?: (end: BattleEnd) => void;
  /** Unexpected simulator exception (the battle is ended as a tie with reason `error`). */
  onError?: (error: unknown) => void;
}

/** Same splitter the sim uses internally (`extractChannelMessages` is not exported). */
const SPLIT_LINES = /^\|split\|p([1-4])\n(.*)\n(.*)|.+/gm;

/** The spectator channel of a raw `update` chunk: `|split|` blocks keep only their public line. */
export function spectatorLines(update: string): string[] {
  const lines: string[] = [];
  for (const [line, player, , shared] of update.matchAll(SPLIT_LINES)) {
    if (!player) lines.push(line);
    else if (shared) lines.push(shared);
  }
  return lines;
}

/**
 * One simulator battle. Wraps Showdown's `Battle` directly (what `BattleStream` wraps) so every
 * call is synchronous: `choose()` knows at once whether the sim accepted the choice, and all the
 * resulting log chunks and requests have been delivered through the callbacks when it returns.
 */
export class BattleSession {
  private readonly battle: ShowdownBattle;
  private readonly log: string[] = [];
  private readonly requests: Partial<Record<SideId, { request: RawRequest; rqid: number }>> = {};
  private readonly errors: Partial<Record<SideId, string>> = {};
  private nextRqid = 1;
  private forfeited: SideId | null = null;
  private end: BattleEnd | null = null;
  private started = false;

  constructor(private readonly options: BattleSessionOptions) {
    this.battle = new Battle({
      formatid: options.formatId,
      ...(options.seed ? { seed: options.seed } : {}),
      send: (type: string, data: string | string[]) =>
        this.receive(type, Array.isArray(data) ? data.join('\n') : data),
    } as ConstructorParameters<typeof Battle>[0]);
    // Custom games are debug formats: spectators would get exact HP and `|debug|` lines with
    // damage rolls. Poke-Air shows the Host percentages only (verified patch, docs/05).
    this.battle.reportExactHP = false;
    // `debugMode` is typed readonly but is a plain field; it only gates `|debug|` output.
    (this.battle as { debugMode: boolean }).debugMode = false;
  }

  /** Adds both players; the sim starts the battle and emits the first chunk + requests. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.run(() => {
      for (const side of SIDE_IDS) {
        const { name, avatar, team } = this.options.sides[side];
        this.battle.setPlayer(side, { name, avatar: avatar ?? '', team: TeamService.pack(team) });
      }
    });
  }

  /** Sends a side's choice. `false` = rejected by the sim (the current request stays). */
  choose(side: SideId, choice: string): boolean {
    if (this.ended) return false;
    delete this.errors[side];
    const accepted = this.run(() => this.battle.choose(side, choice));
    return accepted === true && !this.errors[side];
  }

  /** Cancels a side's choice while the other side is still choosing. `false` = not possible. */
  undo(side: SideId): boolean {
    if (this.ended) return false;
    delete this.errors[side];
    this.run(() => this.battle.undoChoice(side));
    return !this.errors[side];
  }

  forfeit(side: SideId): void {
    if (this.ended) return;
    this.forfeited = side;
    this.run(() => this.battle.lose(side));
  }

  get ended(): boolean {
    return this.end !== null;
  }

  get turn(): number {
    return this.battle.turn;
  }

  /** Full public log (for a Host that reconnects mid-battle). */
  get spectatorLog(): readonly string[] {
    return this.log;
  }

  /** Input log: with the seed, replays the battle deterministically (recovery, replays). */
  get inputLog(): readonly string[] {
    return this.battle.inputLog;
  }

  currentRequest(side: SideId): { request: RawRequest; rqid: number } | undefined {
    return this.requests[side];
  }

  /** Non-zero stat stages of the side's active Pokémon, by nickname (owner-only request data). */
  activeBoosts(side: SideId): Record<string, Partial<Record<BoostId, number>>> {
    const boosts: Record<string, Partial<Record<BoostId, number>>> = {};
    for (const pokemon of this.battle.getSide(side).active) {
      if (!pokemon) continue;
      const stages: Partial<Record<BoostId, number>> = {};
      for (const [stat, value] of Object.entries(pokemon.boosts as Record<string, number>)) {
        if (value) stages[stat as BoostId] = value;
      }
      boosts[pokemon.name] = stages;
    }
    return boosts;
  }

  summary(): Record<SideId, BattleSideSummary> {
    const summary = {} as Record<SideId, BattleSideSummary>;
    for (const side of SIDE_IDS) {
      const pokemon = this.battle.getSide(side).pokemon;
      const fainted = pokemon.filter((p) => p.fainted).length;
      summary[side] = { fainted, remaining: pokemon.length - fainted, total: pokemon.length };
    }
    return summary;
  }

  destroy(): void {
    this.battle.destroy();
  }

  // ── Internals ────────────────────────────────────────────────────

  /** Runs a sim call, flushes its output and turns exceptions into an `error` end. */
  private run<T>(call: () => T): T | undefined {
    try {
      const result = call();
      this.battle.sendUpdates();
      this.checkEnd();
      return result;
    } catch (error) {
      this.options.onError?.(error);
      this.finish({ winner: null, reason: 'error' });
      return undefined;
    }
  }

  private receive(type: string, data: string): void {
    if (type === 'update') {
      const lines = spectatorLines(data);
      this.log.push(...lines);
      this.options.onSpectator?.(lines);
    } else if (type === 'sideupdate') {
      const [side, ...lines] = data.split('\n') as [SideId, ...string[]];
      for (const line of lines) this.receiveSideLine(side, line);
    }
  }

  private receiveSideLine(side: SideId, line: string): void {
    if (line.startsWith('|request|')) {
      const request = JSON.parse(line.slice('|request|'.length)) as RawRequest;
      // An `update` re-sends the same decision with fresh flags: keep its id.
      const previous = this.requests[side];
      const rqid = request.update && previous ? previous.rqid : this.nextRqid++;
      this.requests[side] = { request, rqid };
      this.options.onRequest?.(side, request, rqid);
    } else if (line.startsWith('|error|')) {
      this.errors[side] = line.slice('|error|'.length);
    }
  }

  private checkEnd(): void {
    if (this.end || !this.battle.ended) return;
    this.finish({ winner: this.winnerSide(), reason: this.forfeited ? 'forfeit' : 'normal' });
  }

  private finish(end: BattleEnd): void {
    if (this.end) return;
    this.end = end;
    this.options.onEnd?.(end);
  }

  private winnerSide(): SideId | null {
    if (this.forfeited) return this.forfeited === 'p1' ? 'p2' : 'p1';
    const name = this.battle.winner;
    if (!name) return null;
    // Side names can collide (same player names on both teams): prefer the side still standing.
    const named = SIDE_IDS.filter((side) => this.battle.getSide(side).name === name);
    if (named.length === 1) return named[0] ?? null;
    return SIDE_IDS.find((side) => this.battle.getSide(side).pokemonLeft > 0) ?? null;
  }
}
