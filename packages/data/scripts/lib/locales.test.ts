import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv.js';
import { LOCALES, localizeNames, newestFlavorTexts } from './locales.js';

const ES = LOCALES['es-ES'];

describe('build:locales · names', () => {
  const roster = {
    species: [
      { id: 'raichu', name: 'Raichu', baseSpecies: 'Raichu', megaStones: [] },
      { id: 'raichualola', name: 'Raichu-Alola', baseSpecies: 'Raichu' },
      { id: 'zoroarkhisui', name: 'Zoroark-Hisui', baseSpecies: 'Zoroark' },
      {
        id: 'charizard',
        name: 'Charizard',
        baseSpecies: 'Charizard',
        megaStones: ['Charizardite X'],
      },
      { id: 'garchomp', name: 'Garchomp', baseSpecies: 'Garchomp', megaStones: ['Garchompite'] },
    ],
    items: [
      { id: 'charizarditex', name: 'Charizardite X' },
      { id: 'garchompite', name: 'Garchompite' },
      { id: 'leftovers', name: 'Leftovers' },
      { id: 'lifeorb', name: 'Life Orb' },
    ],
  } as unknown as Parameters<typeof localizeNames>[2];

  const texts = {
    pokedex: {
      raichu: { name: 'Raichu' },
      garchomp: { name: 'Garchomp' },
      missingno: { name: null },
    },
    moves: { earthquake: { name: 'Terremoto' }, tackle: undefined },
    abilities: { roughskin: { name: 'Piel Tosca' } },
    items: { leftovers: { name: 'Restos' }, garchompite: { name: 'Garchompita' } },
    natures: { Jolly: 'Alegre', Hardy: null },
  };

  it('keeps only translated entries, keyed by Showdown id', () => {
    const names = localizeNames(ES, texts, roster);
    expect(names.moves).toEqual({ earthquake: 'Terremoto' });
    expect(names.abilities).toEqual({ roughskin: 'Piel Tosca' });
    expect(names.natures).toEqual({ jolly: 'Alegre' });
    expect(names.species).not.toHaveProperty('missingno');
    expect(names.items).not.toHaveProperty('lifeorb'); // English fallback in the web app
  });

  it('names untranslated regional formes after their translated base species', () => {
    const { species } = localizeNames(ES, texts, roster);
    expect(species.raichualola).toBe('Raichu de Alola');
    // No translated base species (Zoroark is missing here): stays English.
    expect(species).not.toHaveProperty('zoroarkhisui');
  });

  it('follows the official pattern for untranslated Mega Stones only', () => {
    const { items } = localizeNames(ES, texts, roster);
    expect(items.charizarditex).toBe('Charizardita X');
    expect(items.garchompite).toBe('Garchompita'); // Showdown's own translation wins
    expect(items.leftovers).toBe('Restos');
    expect(ES.megaStone('Lucarionite')).toBe('Lucarionita');
  });
});

describe('build:locales · descriptions', () => {
  // PokeAPI rows: entry id, version group, language id, text.
  const entries = [
    ['1', 'stealth-rock'],
    ['2', 'u-turn'],
    ['3', 'splash'],
  ];
  const rows = [
    ['1', '20', '7', 'Rocas viejas.'],
    ['1', '25', '7', 'Lanza piedras\nflotantes que da­\nñan al rival.'],
    ['1', '25', '9', 'Floating stones.'],
    ['1', '22', '7', 'Rocas intermedias.'],
    ['2', '25', '7', 'Ataca y vuelve.'],
    ['3', '25', '7', 'No hace nada.'],
  ];

  it('keeps the newest version group in the wanted language, as one paragraph', () => {
    expect(newestFlavorTexts(entries, rows, '7', new Set(['stealthrock', 'uturn']))).toEqual({
      stealthrock: 'Lanza piedras flotantes que dañan al rival.',
      uturn: 'Ataca y vuelve.',
    });
  });
});

describe('parseCsv', () => {
  it('reads quoted commas, escaped quotes and newlines, and drops the header', () => {
    const csv = 'id,text\r\n1,"Hits, then ""flinches""\nthe foe"\n2,plain\n';
    expect(parseCsv(csv)).toEqual([
      ['1', 'Hits, then "flinches"\nthe foe'],
      ['2', 'plain'],
    ]);
  });

  it('keeps a last line without a trailing newline', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['1', '2']]);
  });
});
