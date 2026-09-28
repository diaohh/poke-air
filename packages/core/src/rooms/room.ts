import {
  ACTIVE_PER_SIDE,
  MAX_PLAYERS_PER_ROOM,
  MAX_PLAYERS_PER_TEAM,
  POKEMON_PER_TEAM,
  TEAM_IDS,
  TEAM_SIDE,
  type BattleResult,
  type CompositionStatus,
  type GameType,
  type Locale,
  type PokemonSetData,
  type PublicPlayer,
  type PublicRoomState,
  type RoomPhase,
  type SideId,
  type TeamId,
  type TeamState,
  type TrainerAvatar,
} from '@poke-air/shared';
import { defaultTeamService, type TeamService } from '../team/team-service.js';
import { evaluateComposition } from './composition.js';
import { RoomError } from './room-error.js';

/** Server-side player record. `teamCount`/`quota` are derived, so they are not stored. */
export interface PlayerRecord extends Omit<PublicPlayer, 'teamCount' | 'quota'> {
  reconnectToken: string;
  joinedAt: number;
}

export interface RoomDeps {
  now: () => number;
  newId: () => string;
  /** Random sets source (defaults to the shared Showdown-backed service). */
  teamService?: TeamService;
}

export interface RoomInit {
  code: string;
  hostToken: string;
  locale: Locale;
}

/** What a battle side is made of: the team's players (join order) and their sets. */
export interface BattleSideSetup {
  team: TeamId;
  /** Side name shown in the log: the players' names joined with " & ". */
  name: string;
  players: { playerId: string; sets: PokemonSetData[] }[];
}

/**
 * One game room. Pure state + rules, no I/O: the transport layer calls these methods and
 * broadcasts `toPublicState()` after every successful mutation.
 *
 * Phases: LOBBY → TEAM_BUILDING → BATTLE → RESULTS → LOBBY (docs/01-vision-and-game-flow.md).
 */
export class Room {
  readonly code: string;
  readonly hostToken: string;
  phase: RoomPhase = 'LOBBY';
  gameType: GameType = 'singles';
  locale: Locale;
  hostConnected = false;
  lastActivityAt: number;
  /** When the automatic "battle starts in…" countdown ends (set by the MatchController). */
  countdownEndsAt: number | null = null;
  result: BattleResult | null = null;

  private readonly players = new Map<string, PlayerRecord>();
  /** playerId → team slots (sized to the player's quota when read). */
  private readonly teams = new Map<string, (PokemonSetData | null)[]>();
  private readonly deps: RoomDeps;

  constructor(init: RoomInit, deps: RoomDeps) {
    this.code = init.code;
    this.hostToken = init.hostToken;
    this.locale = init.locale;
    this.deps = deps;
    this.lastActivityAt = deps.now();
  }

  // ── Players ──────────────────────────────────────────────────────

  /** New player joining. Only allowed in LOBBY. Auto-assigned to the smaller team (red on ties). */
  addPlayer(input: { name: string; avatar: TrainerAvatar }): PlayerRecord {
    this.assertPhase('LOBBY');
    if (this.players.size >= MAX_PLAYERS_PER_ROOM) throw new RoomError('ROOM_FULL');

    const sizes = this.teamSizes();
    const team: TeamId = sizes.blue < sizes.red ? 'blue' : 'red';
    if (sizes[team] >= MAX_PLAYERS_PER_TEAM) throw new RoomError('ROOM_FULL');

    const player: PlayerRecord = {
      id: this.deps.newId(),
      reconnectToken: this.deps.newId(),
      name: input.name,
      avatar: input.avatar,
      team,
      connected: true,
      ready: false,
      joinedAt: this.deps.now(),
    };
    this.players.set(player.id, player);
    this.touch();
    return player;
  }

  /** A phone reclaiming its seat (any phase). */
  rejoinPlayer(playerId: string, reconnectToken: string): PlayerRecord {
    const player = this.players.get(playerId);
    if (!player) throw new RoomError('PLAYER_NOT_FOUND');
    if (player.reconnectToken !== reconnectToken) throw new RoomError('INVALID_RECONNECT_TOKEN');
    player.connected = true;
    this.touch();
    return player;
  }

  updatePlayer(playerId: string, changes: { name?: string; avatar?: TrainerAvatar }): PlayerRecord {
    const player = this.requirePlayer(playerId);
    if (changes.name !== undefined) player.name = changes.name;
    if (changes.avatar !== undefined) player.avatar = changes.avatar;
    this.touch();
    return player;
  }

  switchTeam(playerId: string, team: TeamId): PlayerRecord {
    this.assertPhase('LOBBY');
    const player = this.requirePlayer(playerId);
    if (player.team === team) return player;
    if (this.teamSizes()[team] >= MAX_PLAYERS_PER_TEAM) throw new RoomError('TEAM_FULL');
    player.team = team;
    this.touch();
    return player;
  }

  /** Kick or voluntary leave. Only in LOBBY; later phases keep the seat (disconnect instead). */
  removePlayer(playerId: string): void {
    this.assertPhase('LOBBY');
    this.requirePlayer(playerId);
    this.players.delete(playerId);
    this.teams.delete(playerId);
    this.touch();
  }

  setPlayerConnected(playerId: string, connected: boolean): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connected = connected;
    this.touch();
  }

  getPlayer(playerId: string): PlayerRecord | undefined {
    return this.players.get(playerId);
  }

  /** Players in join order (join order decides initial positions in doubles). */
  listPlayers(): PlayerRecord[] {
    return [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  }

  // ── Host / settings ──────────────────────────────────────────────

  setHostConnected(connected: boolean): void {
    this.hostConnected = connected;
    this.touch();
  }

  setGameType(gameType: GameType): void {
    this.assertPhase('LOBBY');
    this.gameType = gameType;
    this.touch();
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
    this.touch();
  }

  // ── Teams (TEAM_BUILDING) ────────────────────────────────────────

  /** Pokémon this player brings: the team's 6 split among its players (docs/04-battle-modes.md). */
  quotaFor(playerId: string): number {
    const player = this.requirePlayer(playerId);
    return Math.floor(POKEMON_PER_TEAM / Math.max(1, this.teamSizes()[player.team]));
  }

  /**
   * Pokémon this player needs to be Ready. A doubles side needs two Pokémon (the sim crashes with
   * one, decision D-44): a solo doubles player brings 2, each player of a pair at least 1.
   */
  minimumFor(playerId: string): number {
    const player = this.requirePlayer(playerId);
    const teammates = Math.max(1, this.teamSizes()[player.team]);
    return Math.max(1, Math.ceil(ACTIVE_PER_SIDE[this.gameType] / teammates));
  }

  teamState(playerId: string): TeamState {
    const slots = this.viewSlots(playerId);
    return { quota: slots.length, minimum: this.minimumFor(playerId), slots };
  }

  /**
   * Fills the given slots (all of them when omitted) with random sets. Species Clause holds across
   * the side: the kept Pokémon and the teammates' Pokémon are excluded. Un-readies the player.
   */
  randomizeTeam(playerId: string, slots?: number[]): TeamState {
    this.assertPhase('TEAM_BUILDING');
    const player = this.requirePlayer(playerId);
    const team = this.slotsOf(playerId);
    const targets = slots ? [...new Set(slots)] : team.map((_, i) => i);
    if (targets.some((slot) => slot >= team.length)) throw new RoomError('INVALID_SLOT');

    const kept = team.filter((set, i): set is PokemonSetData => !!set && !targets.includes(i));
    const excluded = [...kept, ...this.teammateSets(player)].map((set) => set.species);
    const fresh = this.teamService().randomSets(targets.length, excluded);
    targets.forEach((slot, i) => {
      team[slot] = fresh[i] ?? null;
    });
    compactSlots(team);

    player.ready = false;
    this.touch();
    return this.teamState(playerId);
  }

  /**
   * Saves an edited set in `slot` (validated with the Casual ruleset) or removes the Pokémon there
   * (`null`). Species Clause holds across the side: the player's other slots and their teammates'.
   */
  setSlot(playerId: string, slot: number, set: PokemonSetData | null): TeamState {
    if (set === null) return this.clearSlot(playerId, slot);
    this.assertPhase('TEAM_BUILDING');
    const player = this.requirePlayer(playerId);
    const team = this.slotsOf(playerId);
    if (slot >= team.length) throw new RoomError('INVALID_SLOT');

    const valid = this.teamService().validateSet(set);
    const others = [
      ...team.filter((other, i): other is PokemonSetData => !!other && i !== slot),
      ...this.teammateSets(player),
    ];
    this.assertSpeciesFree(valid, others);

    team[slot] = valid;
    compactSlots(team);
    player.ready = false;
    this.touch();
    return this.teamState(playerId);
  }

  /**
   * Replaces the player's team with Showdown text (paste or saved team). Keeps the first `quota`
   * Pokémon; Pokémon clashing with a teammate's (or an earlier one's) species are left out.
   */
  importTeam(playerId: string, text: string): { state: TeamState; count: number; skipped: number } {
    this.assertPhase('TEAM_BUILDING');
    const player = this.requirePlayer(playerId);
    const team = this.slotsOf(playerId);
    const sets = this.teamService().importTeam(text);

    const kept: PokemonSetData[] = [];
    const taken = this.teammateSets(player);
    let clash: string | null = null;
    for (const set of sets) {
      if (kept.length >= team.length) break;
      if (this.speciesTaken(set, [...taken, ...kept])) {
        clash ??= set.species;
        continue;
      }
      kept.push(set);
    }
    if (kept.length === 0) throw new RoomError('SPECIES_CLAUSE', { species: clash ?? '' });

    team.forEach((_, i) => {
      team[i] = kept[i] ?? null;
    });
    player.ready = false;
    this.touch();
    return {
      state: this.teamState(playerId),
      count: kept.length,
      skipped: sets.length - kept.length,
    };
  }

  /** Removes the Pokémon in `slot`; the ones below move up (empty slots stay at the bottom). */
  clearSlot(playerId: string, slot: number): TeamState {
    this.assertPhase('TEAM_BUILDING');
    const player = this.requirePlayer(playerId);
    const team = this.slotsOf(playerId);
    if (slot >= team.length) throw new RoomError('INVALID_SLOT');
    team[slot] = null;
    compactSlots(team);
    player.ready = false;
    this.touch();
    return this.teamState(playerId);
  }

  setReady(playerId: string, ready: boolean): void {
    this.assertPhase('TEAM_BUILDING');
    const player = this.requirePlayer(playerId);
    if (ready) {
      const count = this.teamCount(playerId);
      if (count === 0) throw new RoomError('EMPTY_TEAM');
      const min = this.minimumFor(playerId);
      if (count < min) throw new RoomError('TEAM_TOO_SMALL', { min });
    }
    player.ready = ready;
    this.touch();
  }

  /** Every player is ready with enough Pokémon, and the composition is still valid. */
  allReady(): boolean {
    const players = this.listPlayers();
    return (
      this.phase === 'TEAM_BUILDING' &&
      players.length > 0 &&
      this.composition().valid &&
      players.every((p) => p.ready && this.teamCount(p.id) >= this.minimumFor(p.id))
    );
  }

  setCountdown(endsAt: number | null): void {
    this.countdownEndsAt = endsAt;
  }

  // ── Phase transitions ────────────────────────────────────────────

  startTeamBuilding(): void {
    this.assertPhase('LOBBY');
    if (!this.composition().valid) throw new RoomError('INVALID_COMPOSITION');
    this.phase = 'TEAM_BUILDING';
    for (const player of this.players.values()) this.slotsOf(player.id);
    this.resetReady();
    this.touch();
  }

  startBattle(): void {
    this.assertPhase('TEAM_BUILDING');
    if (!this.allReady()) throw new RoomError('PLAYERS_NOT_READY');
    this.phase = 'BATTLE';
    this.countdownEndsAt = null;
    this.result = null;
    this.touch();
  }

  finishBattle(result: BattleResult): void {
    this.assertPhase('BATTLE');
    this.phase = 'RESULTS';
    this.result = result;
    this.resetReady();
    this.touch();
  }

  /** Same players, same teams: back to team building to tweak and ready up again. */
  rematch(): void {
    this.assertPhase('RESULTS');
    this.phase = 'TEAM_BUILDING';
    this.result = null;
    this.resetReady();
    this.touch();
  }

  /** Teams are kept (players may change teams in the lobby; slots follow the new quota). */
  backToLobby(): void {
    this.assertPhase('TEAM_BUILDING', 'RESULTS');
    this.phase = 'LOBBY';
    this.result = null;
    this.countdownEndsAt = null;
    this.resetReady();
    this.touch();
  }

  // ── Queries ──────────────────────────────────────────────────────

  composition(): CompositionStatus {
    return evaluateComposition(this.gameType, this.teamSizes());
  }

  /** Sides for the simulator: red → p1, blue → p2, each with its players' non-empty slots. */
  battleSides(): Record<SideId, BattleSideSetup> {
    const sides = {} as Record<SideId, BattleSideSetup>;
    for (const team of TEAM_IDS) {
      const players = this.listPlayers().filter((p) => p.team === team);
      sides[TEAM_SIDE[team]] = {
        team,
        name: players.map((p) => p.name).join(' & '),
        players: players.map((p) => ({
          playerId: p.id,
          sets: this.viewSlots(p.id).filter((set): set is PokemonSetData => !!set),
        })),
      };
    }
    return sides;
  }

  hasConnectedClients(): boolean {
    return this.hostConnected || [...this.players.values()].some((p) => p.connected);
  }

  toPublicState(): PublicRoomState {
    return {
      code: this.code,
      phase: this.phase,
      gameType: this.gameType,
      locale: this.locale,
      hostConnected: this.hostConnected,
      players: this.listPlayers().map(({ id, name, avatar, team, connected, ready }) => ({
        id,
        name,
        avatar,
        team,
        connected,
        ready,
        teamCount: this.teamCount(id),
        quota: this.quotaFor(id),
      })),
      composition: this.composition(),
      battleCountdownMs:
        this.countdownEndsAt === null ? null : Math.max(0, this.countdownEndsAt - this.deps.now()),
      result: this.result,
    };
  }

  // ── Internals ────────────────────────────────────────────────────

  /**
   * The player's stored slots, trimmed/extended to the current quota. Mutating: only used when
   * entering or editing in TEAM_BUILDING, where the quota can't change.
   */
  private slotsOf(playerId: string): (PokemonSetData | null)[] {
    const quota = this.quotaFor(playerId);
    const slots = this.teams.get(playerId) ?? [];
    slots.length = Math.min(slots.length, quota);
    while (slots.length < quota) slots.push(null);
    this.teams.set(playerId, slots);
    return slots;
  }

  /** Read-only view sized to the current quota (lobby team switches don't lose stored sets). */
  private viewSlots(playerId: string): (PokemonSetData | null)[] {
    const stored = this.teams.get(playerId) ?? [];
    return Array.from({ length: this.quotaFor(playerId) }, (_, i) => stored[i] ?? null);
  }

  private teamCount(playerId: string): number {
    return this.viewSlots(playerId).filter(Boolean).length;
  }

  private teammateSets(player: PlayerRecord): PokemonSetData[] {
    return this.listPlayers()
      .filter((p) => p.team === player.team && p.id !== player.id)
      .flatMap((p) => this.viewSlots(p.id).filter((set): set is PokemonSetData => !!set));
  }

  private speciesTaken(set: PokemonSetData, others: PokemonSetData[]): boolean {
    const service = this.teamService();
    const base = service.baseSpeciesId(set.species);
    return others.some((other) => service.baseSpeciesId(other.species) === base);
  }

  private assertSpeciesFree(set: PokemonSetData, others: PokemonSetData[]): void {
    if (this.speciesTaken(set, others)) {
      throw new RoomError('SPECIES_CLAUSE', { species: set.species });
    }
  }

  private teamService(): TeamService {
    return this.deps.teamService ?? defaultTeamService();
  }

  private resetReady(): void {
    for (const player of this.players.values()) player.ready = false;
    this.countdownEndsAt = null;
  }

  private teamSizes(): Record<TeamId, number> {
    const sizes = Object.fromEntries(TEAM_IDS.map((t) => [t, 0])) as Record<TeamId, number>;
    for (const player of this.players.values()) sizes[player.team]++;
    return sizes;
  }

  private requirePlayer(playerId: string): PlayerRecord {
    const player = this.players.get(playerId);
    if (!player) throw new RoomError('PLAYER_NOT_FOUND');
    return player;
  }

  private assertPhase(...allowed: RoomPhase[]): void {
    if (!allowed.includes(this.phase)) {
      throw new RoomError('WRONG_PHASE', { phase: this.phase });
    }
  }

  private touch(): void {
    this.lastActivityAt = this.deps.now();
  }
}

/**
 * Pokémon first, empty slots last, keeping their order: removing the middle one of three moves the
 * third up, so the empty slots (where new Pokémon go) always sit at the bottom of the list.
 */
function compactSlots(team: (PokemonSetData | null)[]): void {
  const sets = team.filter((set): set is PokemonSetData => !!set);
  team.forEach((_, i) => {
    team[i] = sets[i] ?? null;
  });
}
