import type { BattleFieldSlot, BattleMoveOption } from '@poke-air/shared';
import { describe, expect, it } from 'vitest';
import { OwnershipLayer, type PublicField } from './ownership.js';
import type { SidePokemon, SideRequest } from './request.js';

/**
 * OwnershipLayer over hand-built side requests (docs/04-battle-modes.md § OwnershipLayer). Red side
 * of a 2v2: Ana brought Garchomp + Lucario, Cleo brought Pikachu + Gengar; the sim orders the side
 * as every player's lead first (Garchomp left, Pikachu right), then the benches.
 */

function move(name: string, target = 'normal', disabled = false): BattleMoveOption {
  return {
    id: name.toLowerCase().replace(/\W/g, ''),
    name,
    type: 'Normal',
    category: 'Physical',
    basePower: 80,
    accuracy: 100,
    pp: 10,
    maxpp: 10,
    target,
    disabled,
    description: '',
  };
}

function mon(name: string, slot: number, extra: Partial<SidePokemon> = {}): SidePokemon {
  const active = slot <= 2;
  return {
    ident: `p1: ${name}`,
    name,
    species: name,
    level: 50,
    hp: 100,
    maxhp: 100,
    fainted: false,
    active,
    slot,
    ...(active ? { position: slot - 1 } : {}),
    item: '',
    ability: '',
    moves: [],
    stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    ...extra,
  };
}

const MOVES = {
  Garchomp: [move('Earthquake', 'allAdjacent'), move('Dragon Claw'), move('Protect', 'self')],
  Pikachu: [move('Thunderbolt'), move('Protect', 'self')],
};

function owners(megas = 1) {
  return new OwnershipLayer({
    p1: [
      { playerId: 'ana', pokemon: ['Garchomp', 'Lucario'], megas },
      { playerId: 'cleo', pokemon: ['Pikachu', 'Gengar'], megas },
    ],
    p2: [{ playerId: 'ben', pokemon: ['Magikarp', 'Feebas'], megas: 2 }],
  });
}

function moveRequest(pokemon?: SidePokemon[]): SideRequest {
  return {
    kind: 'move',
    rqid: 3,
    side: 'p1',
    activePerSide: 2,
    active: [
      {
        position: 0,
        pokemon: 'Garchomp',
        moves: MOVES.Garchomp,
        canMegaEvo: true,
        trapped: false,
      },
      { position: 1, pokemon: 'Pikachu', moves: MOVES.Pikachu, canMegaEvo: false, trapped: false },
    ],
    forceSwitch: [],
    pokemon: pokemon ?? [
      mon('Garchomp', 1),
      mon('Pikachu', 2),
      mon('Lucario', 3),
      mon('Gengar', 4),
    ],
  };
}

function switchRequest(forceSwitch: boolean[], pokemon: SidePokemon[]): SideRequest {
  return {
    kind: 'switch',
    rqid: 4,
    side: 'p1',
    activePerSide: 2,
    active: [],
    forceSwitch,
    pokemon,
  };
}

const slot = (name: string, fainted = false): BattleFieldSlot => ({
  name,
  species: name,
  hp: fainted ? 0 : 100,
  fainted,
});
const FIELD: PublicField = {
  p1: [slot('Garchomp'), slot('Pikachu')],
  p2: [slot('Magikarp', true), slot('Feebas')],
};
const NONE = new Map<string, string[]>();

describe('OwnershipLayer · positions', () => {
  it('maps players to sides and Pokémon to their owners', () => {
    const layer = owners();
    expect(layer.ownersOf('p1')).toEqual(['ana', 'cleo']);
    expect(layer.sideOf('cleo')).toBe('p1');
    expect(layer.sideOf('ben')).toBe('p2');
    expect(layer.sideOf('nobody')).toBeUndefined();
    expect(layer.ownerOf('p1', 'Gengar')).toBe('cleo');
  });

  it('gives each active position to the owner of the Pokémon standing there', () => {
    const layer = owners();
    expect(layer.controllers(moveRequest())).toEqual(['ana', 'cleo']);
    expect(layer.positionsOf('cleo', moveRequest())).toEqual([1]);
    expect(layer.participants(moveRequest())).toEqual(['ana', 'cleo']);
  });

  it('skips fainted and commanding positions (the merge sends pass)', () => {
    const layer = owners();
    const fainted = moveRequest([
      mon('Garchomp', 1),
      mon('Pikachu', 2, { fainted: true, hp: 0 }),
      mon('Lucario', 3),
      mon('Gengar', 4),
    ]);
    expect(layer.controllers(fainted)).toEqual(['ana', null]);
    expect(layer.merge(fainted, new Map([['ana', ['move 2 1']]]))).toBe('move 2 1, pass');

    const commanding = moveRequest([
      mon('Garchomp', 1, { commanding: true }),
      mon('Pikachu', 2),
      mon('Lucario', 3),
      mon('Gengar', 4),
    ]);
    expect(layer.controllers(commanding)).toEqual([null, 'cleo']);
  });

  it('gives a forced switch to the owner of the Pokémon that left', () => {
    const request = switchRequest(
      [false, true],
      [
        mon('Garchomp', 1),
        mon('Pikachu', 2, { fainted: true }),
        mon('Lucario', 3),
        mon('Gengar', 4),
      ],
    );
    expect(owners().controllers(request)).toEqual([null, 'cleo']);
  });

  it('hands a hole over to the ally when the owner has nothing left to send in', () => {
    const request = switchRequest(
      [false, true],
      [
        mon('Garchomp', 1),
        mon('Pikachu', 2, { fainted: true }),
        mon('Lucario', 3),
        mon('Gengar', 4, { fainted: true }),
      ],
    );
    expect(owners().controllers(request)).toEqual([null, 'ana']);
  });

  it('reserves one benched Pokémon per hole, so a hole nobody can fill gets pass', () => {
    // Both leads fainted; only Lucario (Ana's) is left on the bench.
    const request = switchRequest(
      [true, true],
      [
        mon('Garchomp', 1, { fainted: true }),
        mon('Pikachu', 2, { fainted: true }),
        mon('Lucario', 3),
        mon('Gengar', 4, { fainted: true }),
      ],
    );
    const layer = owners();
    expect(layer.controllers(request)).toEqual(['ana', null]);
    expect(layer.merge(request, new Map([['ana', ['switch 3']]]))).toBe('switch 3, pass');
  });
});

describe('OwnershipLayer · per-player requests', () => {
  it("shares only the player's positions and own Pokémon, plus the public field", () => {
    const request = owners().requestFor('ana', moveRequest(), NONE, FIELD);
    expect(request).toMatchObject({ kind: 'move', rqid: 3, side: 'p1', megasLeft: 1 });
    expect(request.active.map((a) => a.pokemon)).toEqual(['Garchomp']);
    expect(request.pokemon.map((p) => p.name)).toEqual(['Garchomp', 'Lucario']);
    expect(request.field).toEqual({ own: FIELD.p1, foe: FIELD.p2 });
    expect(JSON.stringify(request)).not.toContain('Gengar');
    expect(request.pokemon[0]).not.toHaveProperty('commanding');
  });

  it('asks a player with nothing to decide to wait', () => {
    const request = switchRequest(
      [false, true],
      [
        mon('Garchomp', 1),
        mon('Pikachu', 2, { fainted: true }),
        mon('Lucario', 3),
        mon('Gengar', 4),
      ],
    );
    const wait = owners().requestFor('ana', request, NONE, FIELD);
    expect(wait).toMatchObject({ kind: 'wait', active: [], forceSwitch: [] });
    expect(owners().requestFor('cleo', request, NONE, FIELD).forceSwitch).toEqual([
      { position: 1, pokemon: 'Pikachu' },
    ]);
  });

  it("locks the Mega toggle once the player's quota is spent and flags an ally's Mega", () => {
    const layer = owners();
    const parts = new Map([['cleo', ['move 1 2 mega']]]);
    expect(layer.requestFor('ana', moveRequest(), parts, FIELD).allyMega).toBe(true);
    expect(layer.requestFor('cleo', moveRequest(), parts, FIELD).allyMega).toBe(false);

    layer.recordMega('p1', 'Garchomp');
    expect(layer.megasLeft('ana')).toBe(0);
    expect(layer.megasLeft('cleo')).toBe(1);
    expect(layer.requestFor('ana', moveRequest(), NONE, FIELD).active[0]?.canMegaEvo).toBe(false);
  });
});

describe('OwnershipLayer · choices', () => {
  const parse = (player: string, choice: string, parts = NONE, request = moveRequest()) =>
    owners().parsePart(player, request, choice, parts, FIELD);

  it('accepts one action per own position, with a target for single-target moves', () => {
    expect(parse('ana', 'move 2 1')).toEqual(['move 2 1']);
    expect(parse('ana', 'move 1')).toEqual(['move 1']); // spread: no target
    expect(parse('cleo', 'move 1 -1')).toEqual(['move 1 -1']); // aiming at the ally is allowed
    expect(parse('ana', 'switch 3')).toEqual(['switch 3']);
  });

  it('rejects missing or extra targets, wrong counts and switching in a teammate’s Pokémon', () => {
    for (const choice of ['move 2', 'move 1 1', 'move 3 2', 'move 2 1, move 2 1', 'switch 4']) {
      expect(() => parse('ana', choice), choice).toThrowError('INVALID_CHOICE');
    }
    expect(() => parse('ana', 'switch 1')).toThrowError('INVALID_CHOICE'); // already active
    expect(() => parse('ben', 'move 1')).toThrowError('NO_PENDING_REQUEST');
  });

  it('allows one Mega Evolution per team per turn', () => {
    expect(parse('ana', 'move 2 1 mega')).toEqual(['move 2 1 mega']);
    const allyMega = new Map([['cleo', ['move 1 2 mega']]]);
    expect(() => parse('ana', 'move 2 1 mega', allyMega)).toThrowError('MEGA_TAKEN');
    // Pikachu can't Mega Evolve at all.
    expect(() => parse('cleo', 'move 1 2 mega')).toThrowError('INVALID_CHOICE');
  });

  it('lets the solo player of a 1v2 spend two Megas, but not on the same turn', () => {
    const solo = new OwnershipLayer({
      p1: [{ playerId: 'ana', pokemon: ['Garchomp', 'Pikachu', 'Lucario'], megas: 2 }],
      p2: [],
    });
    const request = moveRequest([mon('Garchomp', 1), mon('Pikachu', 2), mon('Lucario', 3)]);
    request.active = request.active.map((a) => ({ ...a, canMegaEvo: true }));
    expect(() => solo.parsePart('ana', request, 'move 3 mega, move 2 mega', NONE)).toThrowError(
      'MEGA_TAKEN',
    );
    expect(solo.parsePart('ana', request, 'move 3 mega, move 2', NONE)).toHaveLength(2);
    solo.recordMega('p1', 'Garchomp');
    expect(solo.megasLeft('ana')).toBe(1);
    solo.recordMega('p1', 'Pikachu');
    expect(solo.megasLeft('ana')).toBe(0);
    expect(() => solo.parsePart('ana', request, 'move 3, move 2 mega', NONE)).toThrowError(
      'INVALID_CHOICE',
    );
  });

  it('merges the parts in position order once every participant chose', () => {
    const layer = owners();
    const parts = new Map([['cleo', ['move 1 2']]]);
    expect(layer.merge(moveRequest(), parts)).toBeNull();
    parts.set('ana', ['move 2 1']);
    expect(layer.merge(moveRequest(), parts)).toBe('move 2 1, move 1 2');
  });

  it('builds automatic actions: a usable move at a standing foe, or an own benched Pokémon', () => {
    const layer = owners();
    const disabled = moveRequest();
    disabled.active = disabled.active.map((option) =>
      option.position === 0
        ? { ...option, moves: [move('Earthquake', 'allAdjacent', true), move('Dragon Claw')] }
        : option,
    );
    // Magikarp (foe position 1) fainted: aim at Feebas (loc 2).
    expect(layer.defaultPart('ana', disabled, FIELD)).toEqual(['move 2 2']);
    expect(layer.parsePart('cleo', moveRequest(), 'default', NONE, FIELD)).toEqual(['move 1 2']);

    const request = switchRequest(
      [false, true],
      [
        mon('Garchomp', 1),
        mon('Pikachu', 2, { fainted: true }),
        mon('Lucario', 3),
        mon('Gengar', 4),
      ],
    );
    expect(layer.defaultPart('cleo', request, FIELD)).toEqual(['switch 4']);
  });
});
