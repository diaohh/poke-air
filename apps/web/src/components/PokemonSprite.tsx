import type { CSSProperties } from 'react';
import { useState } from 'react';
import { cn } from '../lib/cn';
import { usePokemonSprite, type Facing } from '../lib/pokemon-sprites';

interface Props {
  species: string;
  facing?: Facing;
  /** Multiplies the sprite's natural size (pixel art scales by integers best). */
  scale?: number;
  /** Shrink to fit the parent box instead (small tiles: team builder, party rows). */
  fit?: boolean;
  className?: string;
  style?: CSSProperties;
  /** The name is shown next to it: screen readers skip the image. */
  decorative?: boolean;
}

/**
 * A self-hosted Pokémon sprite (see `lib/pokemon-sprites.ts`) at `scale`× its natural size.
 * Falls back to the species' initial on a round badge when no sprite is available.
 */
export function PokemonSprite({
  species,
  facing = 'front',
  scale = 1,
  fit,
  className,
  style,
  decorative,
}: Props) {
  const sprite = usePokemonSprite(species, facing);
  const [failed, setFailed] = useState<string | null>(null);

  if (!sprite || failed === sprite.src) {
    return (
      <span
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : species}
        aria-hidden={decorative}
        className={cn(
          'mon-placeholder grid place-items-center rounded-full font-display leading-none',
          className,
        )}
        style={
          fit
            ? { width: '82%', height: '82%', fontSize: '1.5em', ...style }
            : { width: 64 * scale, height: 64 * scale, fontSize: 30 * scale, ...style }
        }
      >
        {species.charAt(0)}
      </span>
    );
  }

  return (
    <img
      src={sprite.src}
      alt={decorative ? '' : species}
      width={sprite.w * scale}
      height={sprite.h * scale}
      draggable={false}
      onError={() => setFailed(sprite.src)}
      className={cn(
        'object-contain',
        fit ? 'max-h-full max-w-full' : 'max-w-none',
        sprite.pixelated && 'pixelated',
        className,
      )}
      style={style}
    />
  );
}
