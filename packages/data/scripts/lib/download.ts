import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Polite downloader shared by the asset scripts: each file is fetched ONCE (existing files are
 * skipped), sequentially, with a pause between requests (docs/03-data-sources-and-licensing.md).
 */
export const SHOWDOWN_HOST = 'play.pokemonshowdown.com';
export const PUBLIC_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/web/public',
);
const DELAY_MS = 150;

export const stats = { downloaded: 0, skipped: 0, failed: [] as string[] };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Downloads `url` to `file` unless it exists. False on HTTP errors (404 → try the next one). */
export async function download(url: string, file: string): Promise<boolean> {
  if (existsSync(file)) {
    stats.skipped++;
    return true;
  }
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'poke-air asset sync (fan project)' },
    }).finally(() => sleep(DELAY_MS)); // Errors pause too: no burst of retries against the server.
    if (!response.ok) return false;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
    stats.downloaded++;
    return true;
  } catch (error) {
    stats.failed.push(`${url} (${(error as Error).message})`);
    return false;
  }
}

export function report(label: string): void {
  console.log(
    `${label}: ${stats.downloaded} downloaded, ${stats.skipped} already present, ${stats.failed.length} failed.`,
  );
  if (stats.failed.length > 0) {
    console.error(stats.failed.join('\n'));
    // `--lenient` (deploy builds, docs/16-first-deploy.md): a few failed downloads must not fail
    // the build, or its asset cache is never saved; the next build retries the missing files.
    if (!process.argv.includes('--lenient')) process.exitCode = 1;
  }
}
