import { SIDE_TEAM, type EffectDuration, type PublicPlayer, type SideId } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { HpBar } from '../../components/ui/HpBar';
import { PokeBall } from '../../components/ui/PokeBall';
import { StatusPill } from '../../components/ui/StatusPill';
import { cn } from '../../lib/cn';
import { useDexNames } from '../../lib/dex-names';
import { TEAM_SCOPE } from '../../lib/team';
import { activePokemon, type BoostId, type ScenePokemon, type SceneState } from './model';
import { useEffectLabel } from './use-effect-label';

interface Props {
  side: SideId;
  scene: SceneState;
  players: PublicPlayer[];
  /** Player ids still choosing (from `battle:waiting`). */
  waitingFor: string[];
  /** Dex durations of the timed effects in the log (turns left on the side condition chips). */
  effects: Record<string, EffectDuration>;
  /** Mega Evolutions the side may use (one mark each, greyed as they are used; D-48). */
  megaBudget: number;
  /** Narrower card (battle log panel open). */
  compact?: boolean;
  className?: string;
}

/**
 * Trainer(s) + active Pokémon card: names, Mega marks (available / used), Poké Ball row (fainted =
 * grey), "Choosing…" while a player picks, then each active Pokémon with its public HP %, status
 * and stat stages (one big row in singles, a compact row per position in doubles), then the side
 * conditions. Readable from 3 m.
 */
export function SideCard({
  side,
  scene,
  players,
  waitingFor,
  effects,
  megaBudget,
  compact,
  className,
}: Props) {
  const { t } = useTranslation();
  const effectLabel = useEffectLabel();
  const state = scene.sides[side];
  const doubles = scene.activePerSide > 1;
  const positions = Array.from({ length: scene.activePerSide }, (_, i) => i);
  // Listed left → right as on the field (the far side is mirrored).
  const ordered = side === 'p2' ? [...positions].reverse() : positions;
  const choosing = players.filter((p) => waitingFor.includes(p.id));
  const megasUsed = state.pokemon.filter((p) => p.mega).length;
  const balls = Array.from({ length: state.teamSize }, (_, i) => state.pokemon[i]);

  return (
    <section
      className={cn(
        'side-card absolute rounded-lg px-7',
        doubles ? 'py-5' : 'py-6',
        // Doubles cards are narrower: they sit next to the right slot of the near side.
        doubles ? (compact ? 'w-[500px]' : 'w-[600px]') : compact ? 'w-[560px]' : 'w-[640px]',
        TEAM_SCOPE[SIDE_TEAM[side]],
        className,
      )}
    >
      <header className="flex items-center gap-4">
        <span className="min-w-0 flex-1 truncate text-[28px] font-extrabold text-(color:--deep)">
          {state.name || players.map((p) => p.name).join(' & ')}
        </span>
        {Array.from({ length: megaBudget }, (_, i) => {
          const used = i < megasUsed;
          return (
            <span
              key={i}
              role="img"
              aria-label={t(used ? 'host.battle.megaUsed' : 'host.battle.megaReady')}
              title={t(used ? 'host.battle.megaUsed' : 'host.battle.megaReady')}
              className={cn('mega-stone size-9 text-[36px]', used && 'mega-stone--used')}
            />
          );
        })}
        <span className="flex gap-1.5">
          {balls.map((pokemon, i) => (
            <PokeBall key={i} size={doubles ? 24 : 28} tone={pokemon?.fainted ? 'muted' : 'team'} />
          ))}
        </span>
      </header>

      {doubles ? (
        <div className="mt-3 flex flex-col gap-2.5">
          {ordered.map((position) => (
            <CompactRow key={position} mon={activePokemon(scene, side, position)} />
          ))}
        </div>
      ) : (
        <BigRow mon={activePokemon(scene, side)} />
      )}

      <div
        className={cn(
          'flex min-h-10 flex-wrap items-center gap-2.5 text-lg',
          doubles ? 'mt-3' : 'mt-4',
        )}
      >
        {players.length > 1
          ? choosing.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 text-lg font-bold">
                {p.name}
                <StatusPill status="choosing" className="text-base" />
              </span>
            ))
          : choosing.length > 0 && <StatusPill status="choosing" className="text-lg" />}
        {!doubles && <MonTags mon={activePokemon(scene, side)} />}
        {state.conditions.map((condition) => (
          <span key={condition.name} className="tag">
            {effectLabel(condition.name, condition, scene, effects[condition.name])}
          </span>
        ))}
      </div>
    </section>
  );
}

/** Singles: the active Pokémon's name, level and a big HP bar. */
function BigRow({ mon }: { mon: ScenePokemon | undefined }) {
  const { t } = useTranslation();
  const names = useDexNames();
  if (!mon) return <p className="mt-4 text-[30px] font-bold text-muted">…</p>;
  return (
    <>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <span className="truncate text-[44px] leading-tight font-extrabold">
          {names.species(mon.name)}
        </span>
        <span className="shrink-0 text-2xl font-bold text-muted">
          {t('battle.level', { level: mon.level })}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <HpBar percent={mon.hp} className="h-6 flex-1" />
        <span className="w-24 text-right text-[30px] font-extrabold tabular-nums">{mon.hp}%</span>
      </div>
    </>
  );
}

/** Doubles: one line per position — name, HP bar and %, then its status / Mega / stat stages. */
function CompactRow({ mon }: { mon: ScenePokemon | undefined }) {
  const names = useDexNames();
  if (!mon) return <p className="text-2xl font-bold text-muted">…</p>;
  return (
    <div className={cn(mon.fainted && 'opacity-50')}>
      <div className="flex items-center gap-3">
        <span className="w-[190px] shrink-0 truncate text-[28px] leading-tight font-extrabold">
          {names.species(mon.name)}
        </span>
        <HpBar percent={mon.hp} className="h-4 flex-1" />
        <span className="w-20 text-right text-2xl font-extrabold tabular-nums">{mon.hp}%</span>
      </div>
      <div className="mt-1 flex min-h-7 flex-wrap items-center gap-2 text-base empty:hidden">
        <MonTags mon={mon} />
      </div>
    </div>
  );
}

function MonTags({ mon }: { mon: ScenePokemon | undefined }) {
  const { t } = useTranslation();
  if (!mon) return null;
  const boosts = Object.entries(mon.boosts).filter(([, value]) => value) as [BoostId, number][];
  return (
    <>
      {mon.status && (
        <span className={`tag tag--${mon.status}`}>{t(`statuses.${mon.status}`)}</span>
      )}
      {mon.mega && <span className="tag tag--mega">{t('battle.megaTag')}</span>}
      {mon.substitute && <span className="tag tag--substitute">{t('battle.substitute')}</span>}
      {/* Stat stages: green ▲ raised / red ▼ lowered (arrow + color, never color alone). */}
      {boosts.map(([stat, value]) => (
        <span key={stat} className={cn('tag', value > 0 ? 'tag--up' : 'tag--down')}>
          {value > 0 ? '▲' : '▼'}{' '}
          {t('host.battle.boost', {
            stat: t(`boostsShort.${stat}`),
            amount: value > 0 ? `+${value}` : `${value}`,
          })}
        </span>
      ))}
    </>
  );
}
