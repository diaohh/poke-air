import { SIDE_IDS, type BattleRequest, type SideId } from '@poke-air/shared';

/**
 * Humans ↔ simulator sides (docs/04-battle-modes.md § OwnershipLayer).
 *
 * Phase 1 (singles) has exactly one human per side, so this is the identity mapping: the owner
 * gets the whole side request and their choice is the side choice. Phase 3 (doubles 1v2 / 2v2)
 * keeps this interface and implements per-Pokémon ownership: request splitting, choice merging,
 * forced-switch hand-over and the Mega-per-player quota.
 */
export class OwnershipLayer {
  private readonly owners: Record<SideId, string[]>;

  constructor(owners: Record<SideId, string[]>) {
    this.owners = { p1: [...owners.p1], p2: [...owners.p2] };
  }

  ownersOf(side: SideId): readonly string[] {
    return this.owners[side];
  }

  sideOf(playerId: string): SideId | undefined {
    return SIDE_IDS.find((side) => this.owners[side].includes(playerId));
  }

  /** The part of a side request this player decides. `null` when they have nothing to decide. */
  requestFor(playerId: string, sideRequest: BattleRequest): BattleRequest | null {
    return this.owners[sideRequest.side].includes(playerId) ? sideRequest : null;
  }

  /**
   * Builds the side choice once every owner decided their part. Returns `null` while parts are
   * still missing. Phase 1: a single owner, so their choice is the side choice.
   */
  mergeChoices(side: SideId, parts: ReadonlyMap<string, string>): string | null {
    const owners = this.owners[side];
    if (!owners.every((playerId) => parts.has(playerId))) return null;
    return owners.map((playerId) => parts.get(playerId)).join(', ');
  }
}
