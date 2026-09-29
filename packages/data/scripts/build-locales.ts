/**
 * Generates the localized dex names (Phase 4, docs/15-phase-4-plan.md) into
 * `apps/web/public/data/names.<locale>.json` and the localized move / item / ability descriptions
 * into `desc.<locale>.json` (both git-ignored).
 *
 * Descriptions: Showdown has none translated, so they come from PokeAPI's CSV dump (official
 * in-game text, the newest game's version) at a pinned commit, cached like the Showdown tables.
 *
 * Showdown's translated tables (`data/text/<lang>/*.ts`) are in the GitHub repo but not in the npm
 * release, so they are downloaded once at a pinned commit into `packages/data/.cache/` (git-ignored)
 * and loaded with tsx (plain object literals). Names are keyed by Showdown id; anything without a
 * translation is left out and the web falls back to English. On top of Showdown's names:
 * - regional formes without a name get "<base> de Alola / Galar / Hisui / Paldea",
 * - untranslated Mega Stones follow the official pattern ("Garchompite" → "Garchompita").
 *
 * Runs after `build:data` (it reads `teambuilder.json` for the roster). Skips when current;
 * `--force` rebuilds. Without network and without cache it only warns (the app stays in English).
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  toId,
  type DexDescriptionsData,
  type DexNamesData,
  type TeamBuilderData,
} from '@poke-air/shared';
import { parseCsv } from './lib/csv.js';
import { PUBLIC_DIR, SHOWDOWN_HOST } from './lib/download.js';

/** Showdown commit the translations come from (master on 2026-09-23; spike S4). */
const SHOWDOWN_COMMIT = 'a5df8274e85b0889bf2a9b3422a08b39732374fc';
/** Bump when the output shape or the rules below change. */
const GENERATOR_VERSION = 1;
const TABLES = ['pokedex', 'moves', 'abilities', 'items', 'names'] as const;

/** Poke-Air locale → Showdown `data/text` folder, with the locale's own naming rules. */
const LOCALES = {
  'es-ES': {
    folder: 'es',
    regions: { Alola: 'de Alola', Galar: 'de Galar', Hisui: 'de Hisui', Paldea: 'de Paldea' },
    /** Official Spanish Mega Stone names end in "-ita" where the English ones end in "-ite". */
    megaStone: (name: string) => name.replace(/ite( [XYZ])?$/, 'ita$1'),
  },
} as const;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'showdown-text', SHOWDOWN_COMMIT);
const OUTPUT_DIR = join(PUBLIC_DIR, 'data');
const RAW = `https://raw.githubusercontent.com/smogon/pokemon-showdown/${SHOWDOWN_COMMIT}/data/text`;

type TextTable = Record<string, { name?: string | null } | undefined>;
type NameTable = Record<string, string | null | undefined>;

/** Downloads `data/text/<folder>/<table>.ts` once. False when it can't be fetched. */
async function cached(folder: string, table: string): Promise<string | null> {
  const file = join(CACHE, folder, `${table}.ts`);
  if (existsSync(file)) return file;
  try {
    const response = await fetch(`${RAW}/${folder}/${table}.ts`, {
      headers: { 'User-Agent': `poke-air locale sync (fan project; ${SHOWDOWN_HOST})` },
    });
    if (!response.ok) return null;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, await response.text());
    return file;
  } catch {
    return null;
  }
}

/** `{ id: { name } }` → `{ id: name }`, translated entries only. */
function names(table: TextTable | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, entry] of Object.entries(table ?? {})) {
    if (entry?.name) out[id] = entry.name;
  }
  return out;
}

async function buildLocale(locale: keyof typeof LOCALES, roster: TeamBuilderData): Promise<void> {
  const rules = LOCALES[locale];
  const output = join(OUTPUT_DIR, `names.${locale}.json`);
  const stamp = `${SHOWDOWN_COMMIT.slice(0, 12)}:${GENERATOR_VERSION}`;
  if (!process.argv.includes('--force') && existsSync(output)) {
    const existing = JSON.parse(await readFile(output, 'utf8')) as Pick<DexNamesData, 'stamp'>;
    if (existing.stamp === stamp) {
      console.log(`Dex names (${locale}) are up to date (${stamp}).`);
      return;
    }
  }

  const modules: Record<string, Record<string, unknown>> = {};
  for (const table of TABLES) {
    const file = await cached(rules.folder, table);
    if (!file) {
      console.warn(
        `Dex names (${locale}): could not download ${table}.ts; the app stays in English.`,
      );
      return;
    }
    modules[table] = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  }

  const species = names(modules.pokedex?.PokedexText as TextTable);
  const items = names(modules.items?.ItemsText as TextTable);
  // Regional formes without a translation: "<translated base> de Alola".
  for (const entry of roster.species) {
    if (species[entry.id]) continue;
    const forme = /^.+-(Alola|Galar|Hisui|Paldea)$/.exec(entry.name)?.[1] as
      keyof typeof rules.regions | undefined;
    const base = species[toId(entry.baseSpecies)];
    if (forme && base) species[entry.id] = `${base} ${rules.regions[forme]}`;
  }
  // Untranslated Mega Stones follow the official naming pattern.
  const megaStones = new Set(roster.species.flatMap((entry) => entry.megaStones ?? []));
  for (const item of roster.items) {
    if (!items[item.id] && megaStones.has(item.name)) items[item.id] = rules.megaStone(item.name);
  }
  const natures: Record<string, string> = {};
  for (const [name, value] of Object.entries((modules.names?.NatureNames ?? {}) as NameTable)) {
    if (value) natures[toId(name)] = value;
  }

  const data: DexNamesData = {
    stamp,
    species,
    moves: names(modules.moves?.MovesText as TextTable),
    abilities: names(modules.abilities?.AbilitiesText as TextTable),
    items,
    natures,
  };
  const json = JSON.stringify(data);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(output, json);
  const count = (table: Record<string, string>) => Object.keys(table).length;
  console.log(
    `Dex names (${locale}): ${count(species)} species, ${count(data.moves)} moves, ` +
      `${count(data.abilities)} abilities, ${count(items)} items, ${count(natures)} natures · ` +
      `${Math.round(json.length / 1024)} KB (${Math.round(gzipSync(json).length / 1024)} KB gzip)`,
  );
}

// ── Descriptions: official in-game text from PokeAPI's data dump ─────────────────────────────────

/** PokeAPI commit the flavor texts come from (master on 2026-09-26). */
const POKEAPI_COMMIT = '168b1e89467054cda2e7df43ccebbb69b459497a';
const POKEAPI_RAW = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_COMMIT}/data/v2/csv`;
const POKEAPI_CACHE = join(ROOT, '.cache', 'pokeapi', POKEAPI_COMMIT);
/** PokeAPI `languages.csv` ids: 7 = Spanish (Spain); 14 would be Latin American Spanish. */
const POKEAPI_LANGUAGE: Record<keyof typeof LOCALES, string> = { 'es-ES': '7' };

/** Downloads a PokeAPI CSV once (the flavor text files are 1–6 MB). `null` when unavailable. */
async function pokeapiCsv(name: string): Promise<string[][] | null> {
  const file = join(POKEAPI_CACHE, `${name}.csv`);
  if (!existsSync(file)) {
    try {
      const response = await fetch(`${POKEAPI_RAW}/${name}.csv`, {
        headers: { 'User-Agent': 'poke-air locale sync (fan project)' },
      });
      if (!response.ok) return null;
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, await response.text());
    } catch {
      return null;
    }
  }
  return parseCsv(await readFile(file, 'utf8'));
}

/**
 * `{ showdown id: text }` for one kind (moves / items / abilities): the newest game's text in the
 * locale's language. PokeAPI identifiers ("stealth-rock") become Showdown ids with `toId`.
 */
async function flavorTexts(
  list: string,
  texts: string,
  language: string,
  wanted: ReadonlySet<string>,
): Promise<Record<string, string> | null> {
  const [entries, rows] = await Promise.all([pokeapiCsv(list), pokeapiCsv(texts)]);
  if (!entries || !rows) return null;
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

async function buildDescriptions(
  locale: keyof typeof LOCALES,
  roster: TeamBuilderData,
): Promise<void> {
  const output = join(OUTPUT_DIR, `desc.${locale}.json`);
  const stamp = `${POKEAPI_COMMIT.slice(0, 12)}:${GENERATOR_VERSION}`;
  if (!process.argv.includes('--force') && existsSync(output)) {
    const existing = JSON.parse(await readFile(output, 'utf8')) as Pick<
      DexDescriptionsData,
      'stamp'
    >;
    if (existing.stamp === stamp) {
      console.log(`Descriptions (${locale}) are up to date (${stamp}).`);
      return;
    }
  }
  const language = POKEAPI_LANGUAGE[locale];
  const moveIds = new Set(roster.moves.map((move) => move.id));
  const itemIds = new Set(roster.items.map((item) => item.id));
  const abilityIds = new Set(Object.keys(roster.abilities).map(toId));
  const [moves, items, abilities] = await Promise.all([
    flavorTexts('moves', 'move_flavor_text', language, moveIds),
    flavorTexts('items', 'item_flavor_text', language, itemIds),
    flavorTexts('abilities', 'ability_flavor_text', language, abilityIds),
  ]);
  if (!moves || !items || !abilities) {
    console.warn(`Descriptions (${locale}): PokeAPI data unavailable; they stay in English.`);
    return;
  }
  const data: DexDescriptionsData = { stamp, moves, items, abilities };
  const json = JSON.stringify(data);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(output, json);
  const share = (table: Record<string, string>, all: ReadonlySet<string>) =>
    `${Object.keys(table).length}/${all.size}`;
  console.log(
    `Descriptions (${locale}): moves ${share(moves, moveIds)}, items ${share(items, itemIds)}, ` +
      `abilities ${share(abilities, abilityIds)} · ${Math.round(json.length / 1024)} KB ` +
      `(${Math.round(gzipSync(json).length / 1024)} KB gzip)`,
  );
}

const rosterFile = join(OUTPUT_DIR, 'teambuilder.json');
if (!existsSync(rosterFile)) {
  console.warn('Dex names: run `pnpm build:data` first (teambuilder.json is missing).');
} else {
  const roster = JSON.parse(await readFile(rosterFile, 'utf8')) as TeamBuilderData;
  for (const locale of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
    await buildLocale(locale, roster);
    await buildDescriptions(locale, roster);
  }
}
