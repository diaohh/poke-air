import { SIDE_TEAM, type SideId } from '@poke-air/shared';
import { useLayoutEffect, useRef } from 'react';
import { PokemonSprite } from '../../components/PokemonSprite';
import { cn } from '../../lib/cn';
import { TEAM_SCOPE } from '../../lib/team';
import type { ScenePokemon } from './model';

/** Animation classes (`.mon--*` in styles/screens/_battle.scss). */
export type MonAnimation =
  | 'enter'
  | 'lunge-p1'
  | 'lunge-p2'
  | 'cast'
  | 'hit'
  | 'heal'
  | 'status'
  | 'boost'
  | 'unboost'
  | 'mega'
  | 'faint';

const ANIMATIONS: MonAnimation[] = [
  'enter',
  'lunge-p1',
  'lunge-p2',
  'cast',
  'hit',
  'heal',
  'status',
  'boost',
  'unboost',
  'mega',
  'faint',
];

interface Props {
  side: SideId;
  pokemon: ScenePokemon | undefined;
  /** Animation to play now; `animationId` changes to replay the same one. */
  animation: MonAnimation | null;
  animationId: number;
  /** Narrower platforms (battle log panel open). */
  compact?: boolean;
  className?: string;
}

/**
 * One side's Pokémon on its team-tinted platform: back sprite for red (near), front sprite for
 * blue (far). Animations are restarted imperatively on an inner element whose className React
 * never changes, so a re-render can't cut them short.
 */
export function ActiveSlot({ side, pokemon, animation, animationId, compact, className }: Props) {
  const mon = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = mon.current;
    if (!el || !animation) return;
    el.classList.remove(...ANIMATIONS.map((name) => `mon--${name}`));
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(`mon--${animation}`);
  }, [animation, animationId]);

  const near = side === 'p1';
  const faded = pokemon?.fainted && animation !== 'faint';

  return (
    <div
      className={cn(
        'absolute flex flex-col items-center justify-end',
        TEAM_SCOPE[SIDE_TEAM[side]],
        className,
      )}
    >
      <div
        className={cn(
          'relative z-2 -mb-12',
          pokemon?.mega && 'mon--is-mega',
          faded && 'mon--fainted',
        )}
      >
        <div ref={mon} className="mon">
          {pokemon && (
            <PokemonSprite
              key={pokemon.name}
              species={pokemon.species}
              facing={near ? 'back' : 'front'}
              scale={near ? 3.5 : 3}
              decorative
            />
          )}
        </div>
      </div>
      <div
        className={cn(
          'field-platform',
          near ? 'h-[130px]' : 'h-[110px]',
          near ? (compact ? 'w-[480px]' : 'w-[560px]') : compact ? 'w-[380px]' : 'w-[440px]',
        )}
      />
    </div>
  );
}
