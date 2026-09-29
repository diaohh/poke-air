/**
 * Downloads the sprite subset Poke-Air needs into `apps/web/public/sprites/` (git-ignored).
 *
 * Why: Pokémon Showdown asks projects to self-host sprites instead of hotlinking
 * (docs/03-data-sources-and-licensing.md). We fetch each file ONCE, skip files that already exist,
 * and go sequentially to be gentle with their server.
 *
 * - Trainer avatars: `sprites/trainers/<id>.png`.
 * - Item icons: `sprites/itemicons-sheet.png` (one sheet; the dex `spritenum` is each item's index).
 * - The Substitute doll: `sprites/substitutes/gen5(-back)/substitute.png`.
 * - Pokémon: front + back sprites for every species a battle can show (`battleRoster()` from core:
 *   every legal species of the team builder and the randomizer's, plus their Mega / Primal /
 *   battle-only formes; decision D-40). For each one we try
 *   `gen5ani`, then `ani`, then static `gen5` (new Champions Megas often only exist as static
 *   sprites), and record what we got in `sprites/pokemon-manifest.json`, which the web app reads.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Sprites } from '@pkmn/img';
import { battleRoster } from '@poke-air/core';
import { ITEM_ICON_SHEET, SUBSTITUTE_SPRITES, toId, TRAINER_AVATARS } from '@poke-air/shared';
import { download, PUBLIC_DIR, report, SHOWDOWN_HOST as HOST, stats } from './lib/download.js';

const SOURCE = `https://${HOST}/sprites`;
const OUTPUT = join(PUBLIC_DIR, 'sprites');
const MANIFEST = join(OUTPUT, 'pokemon-manifest.json');
/** Preferred graphics first. `@pkmn/img` already falls back to what it knows exists. */
const GENS = ['gen5ani', 'ani', 'gen5'] as const;
const SIDES = { front: 'p2', back: 'p1' } as const;

type Facing = keyof typeof SIDES;

export interface SpriteEntry {
  /** Path under the web root, e.g. "/sprites/gen5ani/garchomp.gif". */
  src: string;
  w: number;
  h: number;
  pixelated: boolean;
}
export type SpriteManifest = Record<string, Partial<Record<Facing, SpriteEntry>>>;

/** Showdown's item icon sheet: one image for every item icon (decision D-42). */
async function fetchItemIcons(): Promise<void> {
  const file = ITEM_ICON_SHEET.url.replace(/^\/sprites\//, '');
  const url = `${SOURCE}/${file}`;
  if (!(await download(url, join(OUTPUT, file)))) stats.failed.push(`${url} (missing)`);
}

/** The Substitute doll (front for the far side, back for the near side). */
async function fetchSubstitutes(): Promise<void> {
  for (const path of Object.values(SUBSTITUTE_SPRITES)) {
    const file = path.replace(/^\/sprites\//, '');
    const url = `${SOURCE}/${file}`;
    if (!(await download(url, join(OUTPUT, file)))) stats.failed.push(`${url} (missing)`);
  }
}

async function fetchTrainers(): Promise<void> {
  for (const id of TRAINER_AVATARS) {
    const url = `${SOURCE}/trainers/${id}.png`;
    if (!(await download(url, join(OUTPUT, 'trainers', `${id}.png`)))) {
      stats.failed.push(`${url} (missing)`);
    }
  }
}

/** First candidate sprite that exists locally or can be downloaded. */
async function resolveSprite(species: string, facing: Facing): Promise<SpriteEntry | undefined> {
  const seen = new Set<string>();
  for (const gen of GENS) {
    const sprite = Sprites.getPokemon(species, { gen, side: SIDES[facing], domain: HOST });
    if (seen.has(sprite.url)) continue;
    seen.add(sprite.url);
    const path = new URL(sprite.url).pathname; // "/sprites/gen5ani/garchomp.gif"
    const file = join(OUTPUT, path.replace(/^\/sprites\//, ''));
    if (await download(sprite.url, file)) {
      return { src: path, w: sprite.w, h: sprite.h, pixelated: sprite.pixelated };
    }
  }
  return undefined;
}

async function readManifest(): Promise<SpriteManifest> {
  try {
    return JSON.parse(await readFile(MANIFEST, 'utf8')) as SpriteManifest;
  } catch {
    return {};
  }
}

async function fetchPokemon(): Promise<void> {
  const manifest = await readManifest();
  const roster = battleRoster();
  const missing: string[] = [];
  console.log(`Pokémon roster: ${roster.length} species/formes.`);

  for (const [index, species] of roster.entries()) {
    const id = toId(species);
    const entry = (manifest[id] ??= {});
    for (const facing of Object.keys(SIDES) as Facing[]) {
      const known = entry[facing];
      if (known && existsSync(join(OUTPUT, known.src.replace(/^\/sprites\//, '')))) {
        stats.skipped++;
        continue;
      }
      const sprite = await resolveSprite(species, facing);
      if (sprite) entry[facing] = sprite;
      else missing.push(`${species} (${facing})`);
    }
    if ((index + 1) % 50 === 0) console.log(`  ${index + 1} / ${roster.length}`);
  }

  await mkdir(OUTPUT, { recursive: true });
  await writeFile(MANIFEST, `${JSON.stringify(manifest)}\n`);
  if (missing.length > 0) {
    console.warn(`No sprite found for ${missing.length} (the app shows a placeholder):`);
    console.warn(`  ${missing.join(', ')}`);
  }
}

await fetchTrainers();
await fetchItemIcons();
await fetchSubstitutes();
await fetchPokemon();

report('Sprites');
