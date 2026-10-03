import { formatTeamText, type PokemonSetData } from '@poke-air/shared';
import { describe, expect, it } from 'vitest';
import type { ShowdownSet } from '../battle/showdown.js';
import { RoomError } from '../rooms/room-error.js';
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

  it('generates a valid set for a requested species', () => {
    const garchomp = new TeamService().randomSetFor('Garchomp', () => 0.5);
    expect(garchomp).toMatchObject({ species: 'Garchomp', level: BATTLE_LEVEL });
    expect(garchomp.moves.length).toBeGreaterThan(0);
    expect(() => new TeamService().randomSetFor('Missingno')).toThrowError('INVALID_SET');
  });

  it('lists the sprite roster with Megas and battle-only formes', () => {
    const roster = battleRoster();
    expect(roster.length).toBeGreaterThan(300);
    expect(roster).toContain('Garchomp');
    expect(roster).toContain('Garchomp-Mega');
  });
});

describe('TeamService · validation (Casual ruleset)', () => {
  const service = new TeamService();
  const sp = { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 };
  const garchomp: PokemonSetData = {
    name: 'Chompy',
    species: 'Garchomp',
    item: 'Garchompite',
    ability: 'Rough Skin',
    moves: ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Protect'],
    nature: 'Jolly',
    evs: sp,
    level: 100,
  };

  function problem(set: PokemonSetData): RoomError {
    try {
      service.validateSet(set);
    } catch (error) {
      if (error instanceof RoomError) return error;
      throw error;
    }
    throw new Error('Expected INVALID_SET');
  }

  it('accepts a legal set and normalizes it (no nickname, level 50, dex names)', () => {
    const valid = service.validateSet({ ...garchomp, item: 'garchompite', moves: ['earthquake'] });
    expect(valid).toMatchObject({
      name: 'Garchomp',
      species: 'Garchomp',
      item: 'Garchompite',
      moves: ['Earthquake'],
      nature: 'Jolly',
      evs: sp,
      level: BATTLE_LEVEL,
    });
    expect(valid).not.toHaveProperty('ivs');
  });

  it('turns a Mega forme into its base species holding the stone', () => {
    expect(service.validateSet({ ...garchomp, species: 'Garchomp-Mega' })).toMatchObject({
      species: 'Garchomp',
      item: 'Garchompite',
    });
  });

  it('allows 0 Stat Points (neutral Hardy nature) for casual play', () => {
    const zero = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    const { nature, ...noNature } = garchomp;
    expect(nature).toBe('Jolly');
    expect(service.validateSet({ ...noNature, evs: zero }).nature).toBe('Hardy');
  });

  it('rejects Stat Points over 32 per stat or 66 in total, with the validator text', () => {
    const perStat = problem({ ...garchomp, evs: { ...sp, atk: 33, spe: 31 } });
    expect(perStat.code).toBe('INVALID_SET');
    expect(String(perStat.params?.details)).not.toBe('');
    expect(problem({ ...garchomp, evs: { ...sp, hp: 3 } }).code).toBe('INVALID_SET');
  });

  it('rejects other gimmick items and moves the species cannot learn', () => {
    expect(problem({ ...garchomp, item: 'Dragonium Z' }).code).toBe('INVALID_SET');
    expect(problem({ ...garchomp, moves: ['Spore'] }).code).toBe('INVALID_SET');
  });

  it('imports Showdown text, dropping nicknames, IVs and shiny', () => {
    const [set, ...rest] = service.importTeam(
      [
        'Chompy (Garchomp) (M) @ Garchompite',
        'Ability: Rough Skin',
        'Shiny: Yes',
        'EVs: 2 HP / 32 Atk / 32 Spe',
        'Jolly Nature',
        'IVs: 0 Atk',
        '- Earthquake',
        '- Dragon Claw',
        '',
        'Pikachu @ Light Ball',
        'Ability: Static',
        '- Thunderbolt',
      ].join('\n'),
    );
    expect(set).toMatchObject({
      name: 'Garchomp',
      species: 'Garchomp',
      gender: 'M',
      evs: sp,
      nature: 'Jolly',
      moves: ['Earthquake', 'Dragon Claw'],
    });
    expect(set).not.toHaveProperty('shiny');
    expect(set).not.toHaveProperty('ivs');
    expect(rest.map((s) => s.species)).toEqual(['Pikachu']);
  });

  it('round-trips the exported text through the import', () => {
    const team = [service.validateSet(garchomp), service.randomSetFor('Pikachu', () => 0.3)];
    expect(service.importTeam(formatTeamText(team))).toEqual(team);
  });

  it('names the illegal Pokémon of an import, and rejects text that is not a team', () => {
    try {
      service.importTeam('Garchomp @ Dragonium Z\nAbility: Rough Skin\n- Earthquake');
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_SET', params: { species: 'Garchomp' } });
    }
    expect(() => service.importTeam('')).toThrowError('INVALID_IMPORT');
  });
});
