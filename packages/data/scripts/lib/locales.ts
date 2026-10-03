import { toId, type DexNamesData, type TeamBuilderData } from '@poke-air/shared';

/**
 * Pure rules of `build:locales` (docs/15-phase-4-plan.md): Showdown's translated names plus our
 * own fill-ins, and the newest in-game description per entry from PokeAPI's CSV rows.
 */

export type Region = 'Alola' | 'Galar' | 'Hisui' | 'Paldea';

export interface LocaleRules {
  /** Showdown `data/text/<folder>`. */
  folder: string;
  /** Regional forme suffix: "Raichu-Alola" → "<translated Raichu> de Alola". */
  regions: Record<Region, string>;
  /** Official name of a Mega Stone Showdown has no translation for. */
  megaStone: (name: string) => string;
}

/** Poke-Air locale → its Showdown folder and naming rules. */
export const LOCALES = {
  'es-ES': {
    folder: 'es',
    regions: { Alola: 'de Alola', Galar: 'de Galar', Hisui: 'de Hisui', Paldea: 'de Paldea' },
    /** Official Spanish Mega Stone names end in "-ita" where the English ones end in "-ite". */
    megaStone: (name: string) => name.replace(/ite( [XYZ])?$/, 'ita$1'),
  },
} as const satisfies Record<string, LocaleRules>;

export type BuiltLocale = keyof typeof LOCALES;

export type TextTable = Record<string, { name?: string | null } | undefined>;
export type NameTable = Record<string, string | null | undefined>;

/** The Showdown text tables `build:locales` reads. */
export interface ShowdownTexts {
  pokedex?: TextTable;
  moves?: TextTable;
  abilities?: TextTable;
  items?: TextTable;
  natures?: NameTable;
}

/** `{ id: { name } }` → `{ id: name }`, translated entries only. */
export function names(table: TextTable | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, entry] of Object.entries(table ?? {})) {
    if (entry?.name) out[id] = entry.name;
  }
  return out;
}

/**
 * Localized names by Showdown id. Anything without a translation is left out (the web falls back
 * to English), except regional formes and Mega Stones, which follow the official patterns.
 */
export function localizeNames(
  rules: LocaleRules,
  texts: ShowdownTexts,
  roster: Pick<TeamBuilderData, 'species' | 'items'>,
): Omit<DexNamesData, 'stamp'> {
  const species = names(texts.pokedex);
  const items = names(texts.items);
  for (const entry of roster.species) {
    if (species[entry.id]) continue;
    const forme = /^.+-(Alola|Galar|Hisui|Paldea)$/.exec(entry.name)?.[1] as Region | undefined;
    const base = species[toId(entry.baseSpecies)];
    if (forme && base) species[entry.id] = `${base} ${rules.regions[forme]}`;
  }
  const megaStones = new Set(roster.species.flatMap((entry) => entry.megaStones ?? []));
  for (const item of roster.items) {
    if (!items[item.id] && megaStones.has(item.name)) items[item.id] = rules.megaStone(item.name);
  }
  const natures: Record<string, string> = {};
  for (const [name, value] of Object.entries(texts.natures ?? {})) {
    if (value) natures[toId(name)] = value;
  }
  return {
    species,
    moves: names(texts.moves),
    abilities: names(texts.abilities),
    items,
    natures,
  };
}

/**
 * `{ showdown id: text }` from PokeAPI's `<kind>.csv` (id, identifier…) and
 * `<kind>_flavor_text.csv` (id, version group, language, text) rows: the newest game's text in
 * that language, for the wanted ids only. PokeAPI identifiers ("stealth-rock") become Showdown ids.
 */
export function newestFlavorTexts(
  entries: readonly string[][],
  rows: readonly string[][],
  language: string,
  wanted: ReadonlySet<string>,
): Record<string, string> {
  const ids = new Map(entries.map((row) => [row[0], toId(row[1] ?? '')]));
  const newest = new Map<string, { versionGroup: number; text: string }>();
  for (const [entryId = '', versionGroup = '0', languageId, text = ''] of rows) {
    const id = ids.get(entryId);
    if (languageId !== language || !id || !wanted.has(id)) continue;
    const current = newest.get(id);
    if (current && current.versionGroup >= Number(versionGroup)) continue;
    // In-game text wraps lines (and hyphenates with soft hyphens): make it one paragraph.
    const clean = text.replace(/­\s*/g, '').replace(/\s+/g, ' ').trim();
    newest.set(id, { versionGroup: Number(versionGroup), text: clean });
  }
  return Object.fromEntries([...newest].map(([id, { text }]) => [id, text]));
}
