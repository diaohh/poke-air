import { describe, expect, it } from 'vitest';
import type { ShowdownSet } from '../battle/showdown.js';
import { battleRoster } from './roster.js';
import { BATTLE_LEVEL, TeamService } from './team-service.js';

const evs = { hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 };

function set(
  species: string,
  moves: string[],
  item = 'leftovers',
  ability = 'Pressure',
): ShowdownSet {
  return {
    name: species,
    species,
    item,
    ability,
    moves,
    evs,
    level: 54,
    gender: '',
  } as ShowdownSet;
}

/** Deterministic generator: hands out the given batches in order, then repeats the last one. */
function fixedGenerator(...batches: ShowdownSet[][]) {
  let call = 0;
  return () => batches[Math.min(call++, batches.length - 1)] ?? [];
}

describe('TeamService', () => {
  it('maps Showdown sets to display data and forces level 50', () => {
    const service = new TeamService(
      fixedGenerator([set('Garchomp', ['earthquake', 'dragonclaw'], 'garchompite', 'roughskin')]),
    );
    const [garchomp] = service.randomSets(1);
    expect(garchomp).toMatchObject({
      name: 'Garchomp',
      species: 'Garchomp',
      item: 'Garchompite',
      ability: 'Rough Skin',
      moves: ['Earthquake', 'Dragon Claw'],
      level: BATTLE_LEVEL,
      evs,
    });
    expect(garchomp).not.toHaveProperty('gender');
  });

  it('enforces Species Clause by base species, across batches and exclusions', () => {
    const service = new TeamService(
      fixedGenerator(
        [
          set('Rotom-Wash', ['hydropump']),
          set('Rotom-Heat', ['overheat']),
          set('Pikachu', ['thunderbolt']),
        ],
        [
          set('Pikachu', ['thunderbolt']),
          set('Garchomp', ['earthquake']),
          set('Dragonite', ['extremespeed']),
        ],
      ),
    );
    const sets = service.randomSets(3, ['Dragonite']);
    expect(sets.map((s) => s.species)).toEqual(['Rotom-Wash', 'Pikachu', 'Garchomp']);
  });

  it('gives up with INTERNAL_ERROR instead of looping forever', () => {
    const service = new TeamService(fixedGenerator([set('Pikachu', ['thunderbolt'])]));
    expect(() => service.randomSets(2)).toThrowError('INTERNAL_ERROR');
  });

  it('produces full random teams from the real Champions generator', () => {
    const sets = new TeamService().randomSets(6);
    expect(sets).toHaveLength(6);
    expect(new Set(sets.map((s) => s.species)).size).toBe(6);
    expect(sets.every((s) => s.level === 50 && s.moves.length > 0)).toBe(true);
    // Packs into something the simulator accepts.
    expect(TeamService.pack(sets).split(']')).toHaveLength(6);
  });

  it('lists the sprite roster with Megas and battle-only formes', () => {
    const roster = battleRoster();
    expect(roster.length).toBeGreaterThan(300);
    expect(roster).toContain('Garchomp');
    expect(roster).toContain('Garchomp-Mega');
  });
});
