import { SIDE_IDS, SIDE_TEAM, type PublicRoomState, type SideId } from '@poke-air/shared';
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { TrainerSprite } from '../../components/TrainerSprite';
import { cn } from '../../lib/cn';
import { typeStyle } from '../../lib/pokemon-types';
import { local } from '../../lib/storage';
import { formatSeconds, useCountdown } from '../../lib/use-countdown';
import { useBattleAudio } from '../audio/use-host-audio';
import { useHostStore } from '../host-store';
import { ActiveSlot, type MonAnimation, type SlotBox } from './ActiveSlot';
import { BattleLog } from './BattleLog';
import { activePokemon, weatherId, type SceneEvent } from './model';
import { NarrationText } from './NarrationText';
import type { NarrationLine } from './playback';
import { SideCard } from './SideCard';
import { useEffectLabel } from './use-effect-label';
import { useBattlePlayback } from './use-playback';

/** `p1-0`, `p2-1`…: one key per field slot (side + position). */
type SlotKey = `${SideId}-${number}`;
const slotKey = (side: SideId, position = 0): SlotKey => `${side}-${position}`;

/** The animation the current event plays, on the slot it happens to. */
function animationFor(
  event: SceneEvent | null,
  category: string | undefined,
): { key: SlotKey; animation: MonAnimation } | null {
  if (!event?.side) return null;
  const side = event.side;
  const animation = ((): MonAnimation | null => {
    switch (event.kind) {
      case 'switch':
        return 'enter';
      case 'move':
        return category === 'Physical' ? `lunge-${side}` : 'cast';
      case 'damage':
        return 'hit';
      case 'heal':
      case 'faint':
      case 'mega':
      case 'status':
      case 'boost':
      case 'unboost':
        return event.kind;
      case 'effect':
        return 'cast';
      default:
        return null;
    }
  })();
  return animation ? { key: slotKey(side, event.position), animation } : null;
}

interface FieldLayout {
  /** Top chips (turn, timer, field effects). Class names spelled out so Tailwind generates them. */
  chips: string;
  /** Slot boxes per side, by position (field px). Doubles: the far side is mirrored (D-48). */
  slots: Record<SideId, SlotBox[]>;
  sprite: Record<SideId, number>;
  platform: Record<SideId, { width: number; height: number }>;
  trainers: Record<SideId, { at: string; size: string }>;
  cards: Record<SideId, string>;
}

/**
 * Field layouts by format: `wide` = full stage width (1832 × 752 field px); `compact` = next to
 * the battle log panel (1392 px wide). Red (p1) near, blue (p2) far.
 */
const LAYOUTS: Record<'singles' | 'doubles', Record<'wide' | 'compact', FieldLayout>> = {
  singles: {
    wide: {
      chips: 'top-7 left-1/2 -translate-x-1/2',
      slots: {
        p1: [{ left: 230, top: 300, width: 560, height: 420 }],
        p2: [{ left: 1110, top: 60, width: 440, height: 330 }],
      },
      sprite: { p1: 3.5, p2: 3 },
      platform: { p1: { width: 560, height: 130 }, p2: { width: 440, height: 110 } },
      trainers: {
        p1: { at: 'bottom-6 left-6', size: 'size-[230px]' },
        p2: { at: 'top-8 right-10', size: 'size-[200px]' },
      },
      cards: { p1: 'right-12 bottom-12', p2: 'top-10 left-12' },
    },
    compact: {
      chips: 'top-7 left-[640px]',
      slots: {
        p1: [{ left: 190, top: 310, width: 500, height: 410 }],
        p2: [{ left: 790, top: 70, width: 400, height: 320 }],
      },
      sprite: { p1: 3.5, p2: 3 },
      platform: { p1: { width: 480, height: 130 }, p2: { width: 380, height: 110 } },
      trainers: {
        p1: { at: 'bottom-6 left-4', size: 'size-[200px]' },
        p2: { at: 'top-6 right-4', size: 'size-[170px]' },
      },
      cards: { p1: 'right-10 bottom-12', p2: 'top-10 left-10' },
    },
  },
  doubles: {
    wide: {
      chips: 'top-7 left-1/2 -translate-x-1/2',
      slots: {
        p1: [
          { left: 330, top: 330, width: 420, height: 380 },
          { left: 750, top: 330, width: 420, height: 380 },
        ],
        p2: [
          { left: 1300, top: 70, width: 360, height: 290 },
          { left: 920, top: 70, width: 360, height: 290 },
        ],
      },
      sprite: { p1: 3, p2: 2.5 },
      platform: { p1: { width: 380, height: 110 }, p2: { width: 320, height: 90 } },
      trainers: {
        p1: { at: 'bottom-6 left-6', size: 'size-[150px]' },
        p2: { at: 'top-6 right-6', size: 'size-[150px]' },
      },
      cards: { p1: 'right-12 bottom-12', p2: 'top-10 left-12' },
    },
    compact: {
      chips: 'top-7 left-[640px]',
      slots: {
        p1: [
          { left: 230, top: 350, width: 320, height: 360 },
          { left: 540, top: 350, width: 320, height: 360 },
        ],
        p2: [
          { left: 1040, top: 80, width: 300, height: 270 },
          { left: 720, top: 80, width: 300, height: 270 },
        ],
      },
      sprite: { p1: 2.5, p2: 2 },
      platform: { p1: { width: 280, height: 95 }, p2: { width: 260, height: 80 } },
      trainers: {
        p1: { at: 'bottom-4 left-2', size: 'size-[110px]' },
        p2: { at: 'top-4 right-2', size: 'size-[120px]' },
      },
      cards: { p1: 'right-10 bottom-12', p2: 'top-10 left-10' },
    },
  },
};

/** Where a special move's orb starts / lands: the sprite's middle in its slot. */
function orbPoint(layout: FieldLayout, side: SideId, position = 0): { x: number; y: number } {
  const box = layout.slots[side][position] ?? layout.slots[side][0];
  if (!box) return { x: 0, y: 0 };
  return { x: box.left + box.width / 2, y: box.top + box.height * 0.42 };
}

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
  const effectLabel = useEffectLabel();
  useBattleAudio(frame, battle.moves, battle.effects);
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

  const doubles = scene.activePerSide > 1 || room.gameType === 'doubles';
  const layout = LAYOUTS[doubles ? 'doubles' : 'singles'][showLog ? 'compact' : 'wide'];
  const meta = event?.kind === 'move' && event.move ? battle.moves[event.move] : undefined;
  const playing = animationFor(event, meta?.category);
  const projectile = event?.kind === 'move' && meta?.category === 'Special' ? event : null;
  const playersOf = (side: SideId) => room.players.filter((p) => p.team === SIDE_TEAM[side]);
  const weather = scene.weather ? weatherId(scene.weather.name) : null;
  const fieldChips = [
    ...(scene.weather
      ? [
          effectLabel(
            weather ? t(`host.battle.weathers.${weather}`) : scene.weather.name,
            scene.weather,
            scene,
            battle.effects[scene.weather.name],
          ),
        ]
      : []),
    ...[...(scene.terrain ? [scene.terrain] : []), ...scene.field].map((effect) =>
      effectLabel(effect.name, effect, scene, battle.effects[effect.name]),
    ),
  ];
  const orbPath = (move: SceneEvent) => {
    const from = orbPoint(layout, move.side ?? 'p1', move.position);
    const to = orbPoint(layout, move.target ?? 'p2', move.targetPosition);
    return {
      '--x1': `${from.x}px`,
      '--y1': `${from.y}px`,
      '--x2': `${to.x}px`,
      '--y2': `${to.y}px`,
    } as CSSProperties;
  };
  // Mega marks per side = the side's Mega budget (players on the larger team, D-45 / D-48).
  const megaBudget = Math.max(1, playersOf('p1').length, playersOf('p2').length);

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
          const trainers = layout.trainers[side];
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

        {SIDE_IDS.flatMap((side) =>
          layout.slots[side].map((box, position) => (
            <ActiveSlot
              key={slotKey(side, position)}
              side={side}
              pokemon={activePokemon(scene, side, position)}
              animation={playing?.key === slotKey(side, position) ? playing.animation : null}
              animationId={eventId}
              box={box}
              scale={layout.sprite[side]}
              platform={layout.platform[side]}
            />
          )),
        )}

        {projectile?.side && (
          <span
            key={eventId}
            aria-hidden="true"
            className="projectile"
            style={{ ...typeStyle(meta?.type ?? 'Normal'), ...orbPath(projectile) }}
          />
        )}

        {SIDE_IDS.map((side) => (
          <SideCard
            key={side}
            side={side}
            scene={scene}
            players={playersOf(side)}
            waitingFor={waiting?.waitingFor ?? []}
            effects={battle.effects}
            megaBudget={megaBudget}
            compact={showLog}
            className={cn('z-4', layout.cards[side])}
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
