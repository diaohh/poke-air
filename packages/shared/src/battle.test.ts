import { describe, expect, it } from 'vitest';
import { targetOptions } from './battle.js';

describe('targetOptions', () => {
  it('never asks for a target in singles or for spread, self and field moves', () => {
    expect(targetOptions('normal', 0, 1)).toEqual([]);
    for (const target of ['allAdjacentFoes', 'allAdjacent', 'self', 'all', 'allySide']) {
      expect(targetOptions(target, 0, 2), target).toEqual([]);
    }
  });

  it('offers both foes and the ally (never itself) for a single-target move', () => {
    expect(targetOptions('normal', 0, 2)).toEqual([
      { loc: 1, side: 'foe', position: 0 },
      { loc: 2, side: 'foe', position: 1 },
      { loc: -2, side: 'own', position: 1 },
    ]);
    expect(targetOptions('any', 1, 2).map((o) => o.loc)).toEqual([1, 2, -1]);
  });

  it('offers only foes, only the ally, or the ally and itself as the move allows', () => {
    expect(targetOptions('adjacentFoe', 0, 2).map((o) => o.loc)).toEqual([1, 2]);
    expect(targetOptions('adjacentAlly', 1, 2).map((o) => o.loc)).toEqual([-1]);
    expect(targetOptions('adjacentAllyOrSelf', 1, 2).map((o) => o.loc)).toEqual([-1, -2]);
  });
});
