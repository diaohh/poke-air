import type { CSSProperties } from 'react';

/** Types whose color is light enough to need ink text (docs/12-design-system.md § Tokens). */
const LIGHT_TYPES = new Set([
  'normal',
  'electric',
  'ground',
  'ice',
  'steel',
  'rock',
  'bug',
  'grass',
  'fairy',
  'flying',
]);

/** `--tc` = the type's token color, read by `.move-btn`, `.type-chip`, projectiles… */
export function typeStyle(type: string): CSSProperties {
  return {
    '--tc': `var(--color-type-${type.toLowerCase()}, var(--color-type-normal))`,
  } as CSSProperties;
}

export function isLightType(type: string): boolean {
  return LIGHT_TYPES.has(type.toLowerCase());
}
