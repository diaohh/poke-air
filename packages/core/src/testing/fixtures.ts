import type { PokemonSetData } from '@poke-air/shared';

/** Hand-made sets for deterministic battle tests (with `SEED`). */
const evs = { hp: 0, atk: 32, def: 0, spa: 0, spd: 2, spe: 32 };

export function testSet(species: string, moves: string[], item = '', ability = ''): PokemonSetData {
  return { name: species, species, item, ability, moves, evs, level: 50 };
}

/** Outspeeds and one-shots Magikarp with Earthquake (move 1); can Mega Evolve. */
export const GARCHOMP = testSet(
  'Garchomp',
  ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Protect'],
  'Garchompite',
  'Rough Skin',
);
export const MAGIKARP = testSet('Magikarp', ['Splash'], '', 'Swift Swim');
export const PIKACHU = testSet('Pikachu', ['Thunderbolt', 'Quick Attack'], 'Light Ball', 'Static');

export const SEED = 'sodium,0123456789abcdef0123456789abcdef';
