import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';

export type PokeBallTone =
  | 'brand'
  | 'red'
  | 'blue'
  /** Top half in the current team scope color (`--c`). */
  | 'team'
  /** White ball with edges in the team's deep shade (on team badges). */
  | 'on-team'
  | 'gold'
  | 'ok'
  | 'muted'
  /** Outline only: counters/seats not filled yet. */
  | 'empty'
  /** Dashed open-slot outline in the team's deep shade. */
  | 'outline';

interface Props {
  /** Diameter in px (stage px on the Host). */
  size: number;
  tone?: PokeBallTone;
  animation?: 'spin' | 'wobble' | 'bounce';
  className?: string;
}

/** CSS-only Poké Ball (no image). The brand ball is the logo and the loader. */
export function PokeBall({ size, tone = 'brand', animation, className }: Props) {
  return (
    <span
      aria-hidden="true"
      className={cn('ball', `ball--${tone}`, animation && `ball--${animation}`, className)}
      style={{ '--s': `${size}px` } as CSSProperties}
    />
  );
}
