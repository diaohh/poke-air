import { SIDE_TEAM, SUBSTITUTE_SPRITES, type SideId } from '@poke-air/shared';
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

/** The Substitute doll is small in its sprite: drawn this much bigger so it reads on a TV. */
const DOLL_SCALE = 1.6;

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
  /** Stat change to float over the Pokémon for this event ("▲ Attack +2"), if any. */
  badge?: { text: string; up: boolean } | null;
}

/**
 * One position's Pokémon on its team-tinted platform: back sprite for red (near), front sprite
 * for blue (far). Animations are restarted imperatively on an inner element whose className React
 * never changes, so a re-render can't cut them short.
 */
export function ActiveSlot({
  side,
  pokemon,
  animation,
  animationId,
  box,
  scale,
  platform,
  badge,
}: Props) {
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
          pokemon?.mega && !pokemon.substitute && 'mon--is-mega',
          faded && 'mon--fainted',
        )}
      >
        <div ref={mon} className="mon">
          {pokemon?.substitute ? (
            // Behind a Substitute the doll takes the Pokémon's place (like in the games).
            <img
              src={near ? SUBSTITUTE_SPRITES.back : SUBSTITUTE_SPRITES.front}
              alt=""
              width={96 * scale * DOLL_SCALE}
              height={96 * scale * DOLL_SCALE}
              draggable={false}
              className="pixelated max-w-none"
              // The doll is a 30 px figure centered in a 96 px canvas (34 px empty below): pull it
              // down so its base sits where a Pokémon's feet would (~11 px above the canvas edge).
              style={{ marginBottom: -34 * scale * DOLL_SCALE + 11 * scale }}
            />
          ) : (
            pokemon && (
              <PokemonSprite
                key={pokemon.name}
                species={pokemon.species}
                facing={near ? 'back' : 'front'}
                scale={scale}
                decorative
              />
            )
          )}
        </div>
        {badge && (
          <span
            key={animationId}
            aria-hidden="true"
            className={cn('stat-badge', badge.up ? 'stat-badge--up' : 'stat-badge--down')}
          >
            {badge.text}
          </span>
        )}
      </div>
      <div className="field-platform" style={platform} />
    </div>
  );
}
