import { toId } from '@poke-air/shared';
import { useSyncExternalStore } from 'react';

/**
 * Pokémon sprites are self-hosted (`pnpm fetch:sprites`, never hotlinked). The download script
 * writes `/sprites/pokemon-manifest.json`: species id → front/back file (gen5ani when available,
 * else static gen5). Loaded once per page; missing files fall back to the base forme, then to a
 * letter placeholder.
 */
export type Facing = 'front' | 'back';

export interface SpriteInfo {
  src: string;
  w: number;
  h: number;
  pixelated: boolean;
}

type Manifest = Record<string, Partial<Record<Facing, SpriteInfo>>>;

let manifest: Manifest | null = null;
let loading = false;
const listeners = new Set<() => void>();

function load(): void {
  if (loading || manifest) return;
  loading = true;
  fetch('/sprites/pokemon-manifest.json')
    .then((response) => (response.ok ? (response.json() as Promise<Manifest>) : {}))
    .catch(() => ({}))
    .then((data) => {
      manifest = data;
      for (const listener of listeners) listener();
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  load();
  return () => listeners.delete(listener);
}

/**
 * "Raichu-Mega-X" → ids to try: raichumegax, raichumega, raichu. New Champions Megas without a
 * sprite show their base forme (the scene still adds the Mega glow).
 */
export function spriteCandidates(species: string): string[] {
  const parts = species.split('-');
  return parts.map((_, i) => toId(parts.slice(0, parts.length - i).join('-')));
}

export function findSprite(
  data: Manifest | null,
  species: string,
  facing: Facing,
): SpriteInfo | undefined {
  if (!data) return undefined;
  for (const id of spriteCandidates(species)) {
    const sprite = data[id]?.[facing];
    if (sprite) return sprite;
  }
  return undefined;
}

/** `undefined` while the manifest loads or when no sprite exists. */
export function usePokemonSprite(species: string, facing: Facing): SpriteInfo | undefined {
  const data = useSyncExternalStore(
    subscribe,
    () => manifest,
    () => null,
  );
  return findSprite(data, species, facing);
}
