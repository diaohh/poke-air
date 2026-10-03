/**
 * Keeps the downloaded assets between deploy builds (docs/16-first-deploy.md, decision D-64).
 *
 * Sprites, cries and the translation sources are never committed, so a hosted build (Vercel) has to
 * download them. Vercel restores `node_modules/**` between builds, so we park them in
 * `node_modules/.cache/poke-air-assets/`: `restore` copies the cache into the working tree before
 * the download scripts run (they skip existing files, so only new species are fetched) and `save`
 * copies everything back afterwards. Locally it is a harmless no-op round trip.
 *
 *   tsx scripts/asset-cache.ts restore | save
 */
import { existsSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const CACHE = join(REPO, 'node_modules', '.cache', 'poke-air-assets');
/** Repo-relative paths of everything the asset scripts download. */
const ENTRIES = [
  'apps/web/public/sprites',
  'apps/web/public/audio/cries',
  'apps/web/public/audio/cries-manifest.json',
  'packages/data/.cache',
];

const mode = process.argv[2];
if (mode !== 'restore' && mode !== 'save') {
  console.error('Usage: asset-cache.ts restore | save');
  process.exit(1);
}

let copied = 0;
for (const entry of ENTRIES) {
  const [from, to] =
    mode === 'restore'
      ? [join(CACHE, entry), join(REPO, entry)]
      : [join(REPO, entry), join(CACHE, entry)];
  if (!existsSync(from)) continue;
  // Restoring never overwrites what is already in the working tree; saving refreshes the cache.
  await cp(from, to, { recursive: true, force: mode === 'save' });
  copied++;
}
console.log(`Asset cache: ${mode} ${copied}/${ENTRIES.length} entries (${CACHE}).`);
