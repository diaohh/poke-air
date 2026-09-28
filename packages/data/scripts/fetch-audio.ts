/**
 * Optional: downloads Pokémon cries into `apps/web/public/audio/cries/` (git-ignored) and writes
 * `audio/cries-manifest.json` (species id → file), which the Host reads. Without it the game simply
 * has no cries (docs/03-data-sources-and-licensing.md § Audio).
 *
 * Cries are Nintendo / The Pokémon Company assets: same rules as sprites — fetched once, never
 * committed, never hotlinked. Showdown names them like sprites ("dragalge-mega", "raichu-megax");
 * formes without their own cry use the base species ("rotom-wash" → "rotom").
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Sprites } from '@pkmn/img';
import { battleRoster } from '@poke-air/core';
import { toId } from '@poke-air/shared';
import { download, PUBLIC_DIR, report, SHOWDOWN_HOST, stats } from './lib/download.js';

const OUTPUT = join(PUBLIC_DIR, 'audio', 'cries');
const MANIFEST = join(PUBLIC_DIR, 'audio', 'cries-manifest.json');

/** "Rotom-Wash" → ["rotom-wash", "rotom"] (Showdown sprite-style id, then the base species). */
function cryIds(species: string): string[] {
  const url = Sprites.getPokemon(species, { gen: 'gen5', domain: SHOWDOWN_HOST }).url;
  const spriteId = url.slice(url.lastIndexOf('/') + 1).replace(/\.\w+$/, '');
  return [...new Set([spriteId, toId(species.split('-')[0] ?? species)])];
}

async function readManifest(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(MANIFEST, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

const manifest = await readManifest();
const roster = battleRoster();
const missing: string[] = [];
console.log(`Cries for ${roster.length} species/formes.`);

for (const [index, species] of roster.entries()) {
  const key = toId(species);
  const known = manifest[key];
  if (known && existsSync(join(PUBLIC_DIR, known))) {
    stats.skipped++;
    continue;
  }
  let found: string | undefined;
  for (const id of cryIds(species)) {
    const url = `https://${SHOWDOWN_HOST}/audio/cries/${id}.mp3`;
    if (await download(url, join(OUTPUT, `${id}.mp3`))) {
      found = `/audio/cries/${id}.mp3`;
      break;
    }
  }
  if (found) manifest[key] = found;
  else missing.push(species);
  if ((index + 1) % 50 === 0) console.log(`  ${index + 1} / ${roster.length}`);
}

await mkdir(OUTPUT, { recursive: true });
await writeFile(MANIFEST, `${JSON.stringify(manifest)}\n`);
if (missing.length > 0) console.warn(`No cry for ${missing.length}: ${missing.join(', ')}`);
report('Cries');
