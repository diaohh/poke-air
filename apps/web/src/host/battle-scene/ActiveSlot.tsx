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

/** A slot's box on the battle field, in field pixels. */
export interface SlotBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  side: SideId;
  pokemon: ScenePokemon | undefined;
  /** Animation to play now; `animationId` changes to replay the same one. */
  animation: MonAnimation | null;
  animationId: number;
  box: SlotBox;
  /** Sprite size multiplier (smaller in doubles). */
  scale: number;
  /** Platform ellipse size. */
  platform: { width: number; height: number };
}

/**
 * One position's Pokémon on its team-tinted platform: back sprite for red (near), front sprite
 * for blue (far). Animations are restarted imperatively on an inner element whose className React
 * never changes, so a re-render can't cut them short.
 */
export function ActiveSlot({ side, pokemon, animation, animationId, box, scale, platform }: Props) {
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
      className={cn('absolute flex flex-col items-center justify-end', TEAM_SCOPE[SIDE_TEAM[side]])}
      style={box}
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
              scale={scale}
              decorative
            />
          )}
        </div>
      </div>
      <div className="field-platform" style={platform} />
    </div>
  );
}
