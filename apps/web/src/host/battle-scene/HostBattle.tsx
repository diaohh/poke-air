import { SIDE_IDS, SIDE_TEAM, type PublicRoomState, type SideId } from '@poke-air/shared';
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { TrainerSprite } from '../../components/TrainerSprite';
import { cn } from '../../lib/cn';
import { typeStyle } from '../../lib/pokemon-types';
import { local } from '../../lib/storage';
import { formatSeconds, useCountdown } from '../../lib/use-countdown';
import { useHostStore } from '../host-store';
import { ActiveSlot, type MonAnimation } from './ActiveSlot';
import { BattleLog } from './BattleLog';
import { activePokemon, weatherId, type SceneEvent } from './model';
import { NarrationText } from './NarrationText';
import type { NarrationLine } from './playback';
import { SideCard } from './SideCard';
import { useBattlePlayback } from './use-playback';

/** Which animation each side plays for the current event. */
function animationsFor(
  event: SceneEvent | null,
  category: string | undefined,
): Partial<Record<SideId, MonAnimation>> {
  if (!event?.side) return {};
  const side = event.side;
  switch (event.kind) {
    case 'switch':
      return { [side]: 'enter' };
    case 'move':
      return { [side]: category === 'Physical' ? `lunge-${side}` : 'cast' };
    case 'damage':
      return { [side]: 'hit' };
    case 'heal':
      return { [side]: 'heal' };
    case 'faint':
      return { [side]: 'faint' };
    case 'mega':
      return { [side]: 'mega' };
    case 'status':
      return { [side]: 'status' };
    case 'boost':
      return { [side]: 'boost' };
    case 'unboost':
      return { [side]: 'unboost' };
    case 'effect':
      return { [side]: 'cast' };
    default:
      return {};
  }
}

/**
 * Field layouts (field px). `wide` = full stage width; `compact` = next to the battle log panel.
 * Class names are spelled out so Tailwind generates them.
 */
const LAYOUTS = {
  wide: {
    chips: 'top-7 left-1/2 -translate-x-1/2',
    p1: 'top-[300px] left-[230px] h-[420px] w-[560px]',
    p2: 'top-[60px] left-[1110px] h-[330px] w-[440px]',
    p1Trainers: { at: 'bottom-6 left-6', size: 'size-[230px]' },
    p2Trainers: { at: 'top-8 right-10', size: 'size-[200px]' },
    p1Card: 'right-12 bottom-12',
    p2Card: 'top-10 left-12',
    /** Projectile path, red (p1) → blue (p2). */
    orb: { x1: 560, y1: 470, x2: 1290, y2: 190 },
  },
  compact: {
    chips: 'top-7 left-[640px]',
    p1: 'top-[310px] left-[190px] h-[410px] w-[500px]',
    p2: 'top-[70px] left-[790px] h-[320px] w-[400px]',
    p1Trainers: { at: 'bottom-6 left-4', size: 'size-[200px]' },
    p2Trainers: { at: 'top-6 right-4', size: 'size-[170px]' },
    p1Card: 'right-10 bottom-12',
    p2Card: 'top-10 left-10',
    orb: { x1: 400, y1: 470, x2: 950, y2: 190 },
  },
} as const;

const LOG_KEY = 'battleLog';

/**
 * Host battle scene (WP5): the "stadium" rendered from the public log only. Red (p1) is near
 * (back sprite, bottom-left), blue (p2) far (front sprite, top-right). The battle log panel on the
 * right (toggle: L) keeps the turn-by-turn history.
 */
export function HostBattle({ room }: { room: PublicRoomState }) {
  const { t } = useTranslation();
  const battle = useHostStore((s) => s.battle);
  const animated = useHostStore((s) => s.animated);
  const waiting = useHostStore((s) => s.waiting);
  const frame = useBattlePlayback(battle, animated);
  const { scene, event, eventId, messages, log } = frame;
  const [showLog, setShowLog] = useState(() => local.get<boolean>(LOG_KEY) ?? true);
  const seconds = useCountdown(
    waiting?.waitingFor.length ? waiting.timerMs : null,
    waiting?.receivedAt ?? 0,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'l' || e.repeat) return;
      setShowLog((shown) => {
        local.set(LOG_KEY, !shown);
        return !shown;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const layout = LAYOUTS[showLog ? 'compact' : 'wide'];
  const meta = event?.kind === 'move' && event.move ? battle.moves[event.move] : undefined;
  const animations = animationsFor(event, meta?.category);
  const projectile = event?.kind === 'move' && meta?.category === 'Special' ? event : null;
  const playersOf = (side: SideId) => room.players.filter((p) => p.team === SIDE_TEAM[side]);
  const weather = scene.weather ? weatherId(scene.weather) : null;
  const fieldChips = [
    ...(scene.weather ? [weather ? t(`host.battle.weathers.${weather}`) : scene.weather] : []),
    ...(scene.terrain ? [scene.terrain] : []),
    ...scene.field,
  ];
  const { x1, y1, x2, y2 } = layout.orb;
  const orbPath = (side: SideId) =>
    ({
      '--x1': `${side === 'p1' ? x1 : x2}px`,
      '--y1': `${side === 'p1' ? y1 : y2}px`,
      '--x2': `${side === 'p1' ? x2 : x1}px`,
      '--y2': `${side === 'p1' ? y2 : y1}px`,
    }) as CSSProperties;

  return (
    <div
      className={cn(
        'grid min-h-0 grid-rows-[minmax(0,1fr)_168px] gap-5 px-11 pb-9',
        showLog && 'grid-cols-[minmax(0,1fr)_420px]',
      )}
    >
      <div className="battle-field">
        <div className={cn('absolute z-4 flex items-center gap-4 text-[26px]', layout.chips)}>
          {scene.turn > 0 && (
            <span className="battle-chip px-6 py-2.5">
              {t('host.battle.turn', { turn: scene.turn })}
            </span>
          )}
          {seconds !== null && (
            <span
              role="timer"
              aria-label={t('host.battle.timer')}
              className="battle-chip battle-chip--timer px-6 py-2.5"
            >
              {formatSeconds(seconds)}
            </span>
          )}
          {fieldChips.map((chip) => (
            <span key={chip} className="battle-chip px-5 py-2.5 text-[22px]">
              {chip}
            </span>
          ))}
        </div>

        {/* Trainers watch from behind their Pokémon. */}
        {SIDE_IDS.map((side) => {
          const trainers = side === 'p1' ? layout.p1Trainers : layout.p2Trainers;
          return (
            <div
              key={side}
              className={cn('absolute flex gap-2', trainers.at, side === 'p1' && 'z-3')}
            >
              {playersOf(side).map((p) => (
                <TrainerSprite
                  key={p.id}
                  avatar={p.avatar}
                  decorative
                  className={cn(trainers.size, !p.connected && 'opacity-50 grayscale')}
                />
              ))}
            </div>
          );
        })}

        {SIDE_IDS.map((side) => (
          <ActiveSlot
            key={side}
            side={side}
            pokemon={activePokemon(scene, side)}
            animation={animations[side] ?? null}
            animationId={eventId}
            compact={showLog}
            className={side === 'p1' ? layout.p1 : layout.p2}
          />
        ))}

        {projectile?.side && (
          <span
            key={eventId}
            aria-hidden="true"
            className="projectile"
            style={{ ...typeStyle(meta?.type ?? 'Normal'), ...orbPath(projectile.side) }}
          />
        )}

        {SIDE_IDS.map((side) => (
          <SideCard
            key={side}
            side={side}
            scene={scene}
            players={playersOf(side)}
            waitingFor={waiting?.waitingFor ?? []}
            compact={showLog}
            className={cn('z-4', side === 'p2' ? layout.p2Card : layout.p1Card)}
          />
        ))}
      </div>

      {showLog && <BattleLog log={log} />}

      <NarrationBox messages={messages} />
    </div>
  );
}

function NarrationBox({ messages }: { messages: NarrationLine[] }) {
  const { t } = useTranslation();
  const [previous, current] = messages.length > 1 ? messages : [undefined, messages[0]];

  return (
    <div
      className="narration col-start-1 flex items-center justify-between gap-10 rounded-xl px-12"
      aria-live="polite"
    >
      <div className="min-w-0 flex-1">
        {previous && (
          <p className="truncate text-[26px] font-semibold text-muted">
            <NarrationText line={previous} />
          </p>
        )}
        {current && (
          <p
            key={current.id}
            className="narration__line truncate text-[40px] leading-tight font-extrabold"
          >
            <NarrationText line={current} />
          </p>
        )}
      </div>
      <span className="shrink-0 text-xl font-bold text-muted">{t('host.battle.skipHint')}</span>
    </div>
  );
}
