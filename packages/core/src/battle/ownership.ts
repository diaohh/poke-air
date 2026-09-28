import {
  SIDE_IDS,
  targetOptions,
  type BattleFieldSlot,
  type BattleRequest,
  type SideId,
} from '@poke-air/shared';
import { RoomError } from '../rooms/room-error.js';
import type { SideRequest } from './request.js';

/** One human on a side. */
export interface SideOwner {
  playerId: string;
  /** Names of the Pokémon they brought (unique per side: Species Clause, no nicknames — D-37). */
  pokemon: string[];
  /** Mega Evolutions they may use (decision D-45). */
  megas: number;
}

/** What each player of a side chose for the current decision: one action per position they decide. */
export type ChoiceParts = ReadonlyMap<string, readonly string[]>;

/** Public field view per side (`BattleSession.publicField()`). */
export type PublicField = Record<SideId, (BattleFieldSlot | null)[]>;

const isMega = (action: string) => action.endsWith(' mega');

/**
 * Humans ↔ simulator sides (docs/04-battle-modes.md § OwnershipLayer, decision D-43). One sim side
 * per team; each Pokémon belongs to the player who brought it, and whoever owns the Pokémon in a
 * position controls it. For every side request this layer decides who controls each position, gives
 * each player only their share (their positions, their own Pokémon, the public field), validates
 * their part and merges the parts into the side choice (`pass` where nobody decides). It also keeps
 * each player's Mega Evolution quota. Singles is the one-player, one-position case.
 */
export class OwnershipLayer {
  private readonly owners: Record<SideId, SideOwner[]>;
  private readonly ownerByName: Record<SideId, Map<string, string>>;
  private readonly megasUsed = new Map<string, number>();

  constructor(owners: Record<SideId, SideOwner[]>) {
    this.owners = { p1: [...owners.p1], p2: [...owners.p2] };
    this.ownerByName = { p1: new Map(), p2: new Map() };
    for (const side of SIDE_IDS) {
      for (const owner of this.owners[side]) {
        for (const name of owner.pokemon) this.ownerByName[side].set(name, owner.playerId);
      }
    }
  }

  ownersOf(side: SideId): readonly string[] {
    return this.owners[side].map((owner) => owner.playerId);
  }

  sideOf(playerId: string): SideId | undefined {
    return SIDE_IDS.find((side) => this.owners[side].some((o) => o.playerId === playerId));
  }

  /** The player who brought this Pokémon. */
  ownerOf(side: SideId, name: string): string | undefined {
    return this.ownerByName[side].get(name);
  }

  // ── Mega Evolution quota (decision D-45) ─────────────────────────

  megasLeft(playerId: string): number {
    const side = this.sideOf(playerId);
    const owner = side && this.owners[side].find((o) => o.playerId === playerId);
    return Math.max(0, (owner?.megas ?? 0) - (this.megasUsed.get(playerId) ?? 0));
  }

  /** A `|-mega|` line: the Mega counts for the Pokémon's owner. */
  recordMega(side: SideId, name: string): void {
    const owner = this.ownerOf(side, name);
    if (owner) this.megasUsed.set(owner, (this.megasUsed.get(owner) ?? 0) + 1);
  }

  // ── Positions ────────────────────────────────────────────────────

  /**
   * Who decides each position of this side request (`null` = nobody: the merge sends `pass`).
   * - `move`: the owner of the Pokémon in the position (fainted / commanding positions: nobody).
   * - `switch`: the owner of the Pokémon leaving, if they have a Pokémon to send in; else a teammate
   *   who has one (docs/04 rule 5); else nobody. Each hole reserves one benched Pokémon.
   */
  controllers(request: SideRequest): (string | null)[] {
    const { side, activePerSide } = request;
    const controllers: (string | null)[] = [];
    if (request.kind === 'move') {
      for (let position = 0; position < activePerSide; position++) {
        const pokemon = request.pokemon[position];
        const decides = pokemon && request.active[position] && !pokemon.fainted;
        controllers.push(
          decides && !pokemon.commanding ? (this.ownerOf(side, pokemon.name) ?? null) : null,
        );
      }
      return controllers;
    }
    if (request.kind !== 'switch') return Array.from({ length: activePerSide }, () => null);

    const bench = new Map<string, number>();
    for (const pokemon of request.pokemon) {
      const owner = this.ownerOf(side, pokemon.name);
      if (owner && !pokemon.active && !pokemon.fainted)
        bench.set(owner, (bench.get(owner) ?? 0) + 1);
    }
    for (let position = 0; position < activePerSide; position++) {
      if (!request.forceSwitch[position]) {
        controllers.push(null);
        continue;
      }
      const leaving = request.pokemon[position];
      const owner = leaving ? this.ownerOf(side, leaving.name) : undefined;
      const candidates = [owner, ...this.ownersOf(side).filter((id) => id !== owner)];
      const chosen = candidates.find((id): id is string => !!id && (bench.get(id) ?? 0) > 0);
      if (chosen) bench.set(chosen, (bench.get(chosen) ?? 0) - 1);
      controllers.push(chosen ?? null);
    }
    return controllers;
  }

  /** Positions this player decides, in order. */
  positionsOf(playerId: string, request: SideRequest): number[] {
    return this.controllers(request).flatMap((id, position) => (id === playerId ? [position] : []));
  }

  /** Players with something to decide in this request. */
  participants(request: SideRequest): string[] {
    return [...new Set(this.controllers(request).filter((id): id is string => !!id))];
  }

  // ── Per-player requests ──────────────────────────────────────────

  /**
   * This player's share of a side request: their positions, their own Pokémon only (privacy: never
   * a teammate's) and the public field. `wait` when they have nothing to decide.
   */
  requestFor(
    playerId: string,
    request: SideRequest,
    parts: ChoiceParts,
    field: PublicField,
  ): BattleRequest {
    const { side } = request;
    const mine = this.positionsOf(playerId, request);
    const kind = mine.length === 0 ? 'wait' : request.kind;
    const megasLeft = this.megasLeft(playerId);
    return {
      kind,
      rqid: request.rqid,
      side,
      activePerSide: request.activePerSide,
      active:
        kind === 'move'
          ? mine.flatMap((position) => {
              const option = request.active[position];
              return option ? [{ ...option, canMegaEvo: option.canMegaEvo && megasLeft > 0 }] : [];
            })
          : [],
      forceSwitch:
        kind === 'switch'
          ? mine.map((position) => ({
              position,
              pokemon: request.pokemon[position]?.name ?? '',
            }))
          : [],
      pokemon: request.pokemon
        .filter((pokemon) => this.ownerOf(side, pokemon.name) === playerId)
        .map(({ commanding: _commanding, ...pokemon }) => pokemon),
      field: { own: field[side], foe: field[side === 'p1' ? 'p2' : 'p1'] },
      megasLeft,
      allyMega: [...parts].some(([id, actions]) => id !== playerId && actions.some(isMega)),
    };
  }

  // ── Choices ──────────────────────────────────────────────────────

  /**
   * Checks a player's part (one action per position they decide, comma-separated, or `default`)
   * and returns it as a list of actions. Ownership, targets and the Mega rules are checked here;
   * the simulator validates the merged choice.
   */
  parsePart(
    playerId: string,
    request: SideRequest,
    choice: string,
    parts: ChoiceParts,
    field?: PublicField,
  ): string[] {
    const mine = this.positionsOf(playerId, request);
    if (mine.length === 0) throw new RoomError('NO_PENDING_REQUEST');
    if (choice === 'default') return this.defaultPart(playerId, request, field);

    const actions = choice.split(',').map((action) => action.trim());
    if (actions.length !== mine.length) throw new RoomError('INVALID_CHOICE');
    const picked = new Set<number>();
    let megas = 0;
    actions.forEach((action, k) => {
      const position = mine[k] ?? 0;
      const [verb = '', value = '', ...flags] = action.split(' ');
      if (verb === 'switch') {
        const slot = Number(value);
        const pokemon = request.pokemon[slot - 1];
        const trapped = request.kind === 'move' && request.active[position]?.trapped;
        if (
          !pokemon ||
          trapped ||
          pokemon.active ||
          pokemon.fainted ||
          picked.has(slot) ||
          this.ownerOf(request.side, pokemon.name) !== playerId
        ) {
          throw new RoomError('INVALID_CHOICE');
        }
        picked.add(slot);
        return;
      }
      if (verb !== 'move' || request.kind !== 'move') throw new RoomError('INVALID_CHOICE');
      const option = request.active[position];
      const move = option?.moves[Number(value) - 1];
      if (!option || !move || move.disabled) throw new RoomError('INVALID_CHOICE');
      const target = flags.find((flag) => /^-?\d$/.test(flag));
      const targets = targetOptions(move.target, position, request.activePerSide);
      const validTarget =
        targets.length > 0 ? targets.some((t) => String(t.loc) === target) : target === undefined;
      if (!validTarget) throw new RoomError('INVALID_CHOICE');
      if (flags.includes('mega')) {
        if (!option.canMegaEvo || this.megasLeft(playerId) <= megas) {
          throw new RoomError('INVALID_CHOICE');
        }
        megas++;
      }
    });
    // One Mega Evolution per team per turn (a sim limit, docs/04).
    const allyMega = [...parts].some(([id, done]) => id !== playerId && done.some(isMega));
    if (megas > 1 || (megas > 0 && allyMega)) throw new RoomError('MEGA_TAKEN');
    return actions;
  }

  /**
   * Automatic actions for a player who ran out of time (never a Mega): the first usable move aimed
   * at a standing foe, or their first Pokémon that can come in.
   */
  defaultPart(playerId: string, request: SideRequest, field?: PublicField): string[] {
    const foe = field?.[request.side === 'p1' ? 'p2' : 'p1'];
    const used = new Set<number>();
    return this.positionsOf(playerId, request).map((position) => {
      if (request.kind === 'switch' || !request.active[position]) {
        const next = request.pokemon.find(
          (pokemon) =>
            !pokemon.active &&
            !pokemon.fainted &&
            !used.has(pokemon.slot) &&
            this.ownerOf(request.side, pokemon.name) === playerId,
        );
        if (!next) return 'pass';
        used.add(next.slot);
        return `switch ${next.slot}`;
      }
      const moves = request.active[position]?.moves ?? [];
      const index = Math.max(
        0,
        moves.findIndex((move) => !move.disabled),
      );
      const move = moves[index];
      const options = move ? targetOptions(move.target, position, request.activePerSide) : [];
      const target =
        options.find((o) => o.side === 'foe' && foe?.[o.position] && !foe[o.position]?.fainted) ??
        options.find((o) => o.side === 'foe') ??
        options[0];
      return `move ${index + 1}${target ? ` ${target.loc}` : ''}`;
    });
  }

  /**
   * The side choice once every participant chose: each position gets its controller's action, in
   * order; positions nobody decides get `pass` (spike S2: the sim needs them explicit). `null`
   * while a part is missing.
   */
  merge(request: SideRequest, parts: ChoiceParts): string | null {
    const next = new Map<string, number>();
    const actions: string[] = [];
    for (const playerId of this.controllers(request)) {
      if (!playerId) {
        actions.push('pass');
        continue;
      }
      const part = parts.get(playerId);
      if (!part) return null;
      const index = next.get(playerId) ?? 0;
      next.set(playerId, index + 1);
      actions.push(part[index] ?? 'pass');
    }
    return actions.join(', ');
  }
}
