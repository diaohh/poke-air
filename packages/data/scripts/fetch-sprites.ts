/**
 * Downloads the sprite subset Poke-Air needs into `apps/web/public/sprites/` (git-ignored).
 *
 * Why: Pokémon Showdown asks projects to self-host sprites instead of hotlinking
 * (docs/03-data-sources-and-licensing.md). We fetch each file ONCE, skip files that already exist,
 * and go sequentially to be gentle with their server.
 *
 * Currently: trainer avatars. Phase 1 adds Pokémon sprites (gen5ani front/back) for the roster.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRAINER_AVATARS } from '@poke-air/shared';

const SOURCE = 'https://play.pokemonshowdown.com/sprites';
const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), '../../../apps/web/public/sprites');
const DELAY_MS = 150;

interface Job {
  url: string;
  file: string;
}

const jobs: Job[] = TRAINER_AVATARS.map((id) => ({
  url: `${SOURCE}/trainers/${id}.png`,
  file: join(OUTPUT, 'trainers', `${id}.png`),
}));

let downloaded = 0;
let skipped = 0;
const failed: string[] = [];

for (const { url, file } of jobs) {
  if (existsSync(file)) {
    skipped++;
    continue;
  }
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'poke-air sprite sync (fan project)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
    downloaded++;
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  } catch (error) {
    failed.push(`${url} (${(error as Error).message})`);
  }
}

console.log(
  `Sprites: ${downloaded} downloaded, ${skipped} already present, ${failed.length} failed.`,
);
if (failed.length > 0) {
  console.error(failed.join('\n'));
  process.exitCode = 1;
}
