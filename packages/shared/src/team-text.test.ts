import { describe, expect, it } from 'vitest';
import { formatSetText, splitTeamText, teamTextSpecies } from './team-text.js';

describe('Showdown team text', () => {
  it('formats a set with gender, item, level, Stat Points, nature and moves', () => {
    expect(
      formatSetText({
        name: 'Garchomp',
        species: 'Garchomp',
        gender: 'M',
        item: 'Garchompite',
        ability: 'Rough Skin',
        moves: ['Earthquake', 'Dragon Claw'],
        nature: 'Jolly',
        evs: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
        level: 50,
      }),
    ).toBe(
      [
        'Garchomp (M) @ Garchompite',
        'Ability: Rough Skin',
        'Level: 50',
        'EVs: 2 HP / 32 Atk / 32 Spe',
        'Jolly Nature',
        '- Earthquake',
        '- Dragon Claw',
      ].join('\n'),
    );
  });

  it('reads the species from every first-line shape', () => {
    expect(teamTextSpecies('Chompy (Garchomp) (M) @ Garchompite')).toBe('Garchomp');
    expect(teamTextSpecies('Rotom-Wash (F) @ Leftovers')).toBe('Rotom-Wash');
    expect(teamTextSpecies('Pikachu')).toBe('Pikachu');
  });

  it('splits a team into one block per Pokémon, skipping format headers and CRLF', () => {
    const blocks = splitTeamText(
      '=== [gen9] My team ===\r\n\r\nPikachu @ Light Ball\r\n- Thunderbolt\r\n\r\n\r\nGarchomp\n- Earthquake\n',
    );
    expect(blocks).toEqual([
      { species: 'Pikachu', text: 'Pikachu @ Light Ball\n- Thunderbolt' },
      { species: 'Garchomp', text: 'Garchomp\n- Earthquake' },
    ]);
  });
});
