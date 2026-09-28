import { SIDE_TEAM, type PublicPlayer, type SideId } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { HpBar } from '../../components/ui/HpBar';
import { PokeBall } from '../../components/ui/PokeBall';
import { StatusPill } from '../../components/ui/StatusPill';
import { cn } from '../../lib/cn';
import { TEAM_SCOPE } from '../../lib/team';
import { activePokemon, type BoostId, type SceneState } from './model';

interface Props {
  side: SideId;
  scene: SceneState;
  players: PublicPlayer[];
  /** Player ids still choosing (from `battle:waiting`). */
  waitingFor: string[];
  /** Narrower card (battle log panel open). */
  compact?: boolean;
  className?: string;
}

/**
 * Trainer + active Pokémon card: name, Poké Ball row (fainted = grey), Mega mark (available /
 * used), "Choosing…" while a player picks, then the Pokémon with its public HP %, status and
 * stat stages. Readable from 3 m.
 */
export function SideCard({ side, scene, players, waitingFor, compact, className }: Props) {
  const { t } = useTranslation();
  const state = scene.sides[side];
  const mon = activePokemon(scene, side);
  const choosing = players.some((p) => waitingFor.includes(p.id));
  const megaUsed = state.pokemon.some((p) => p.mega);
  const balls = Array.from({ length: state.teamSize }, (_, i) => state.pokemon[i]);
  const boosts = Object.entries(mon?.boosts ?? {}).filter(([, value]) => value) as [
    BoostId,
    number,
  ][];

  return (
    <section
      className={cn(
        'side-card absolute rounded-lg px-7 py-6',
        compact ? 'w-[560px]' : 'w-[640px]',
        TEAM_SCOPE[SIDE_TEAM[side]],
        className,
      )}
    >
      <header className="flex items-center gap-4">
        <span className="min-w-0 flex-1 truncate text-[28px] font-extrabold text-(color:--deep)">
          {state.name || players.map((p) => p.name).join(' & ')}
        </span>
        <span
          role="img"
          aria-label={t(megaUsed ? 'host.battle.megaUsed' : 'host.battle.megaReady')}
          title={t(megaUsed ? 'host.battle.megaUsed' : 'host.battle.megaReady')}
          className={cn('mega-stone size-9 text-[36px]', megaUsed && 'mega-stone--used')}
        />
        <span className="flex gap-1.5">
          {balls.map((pokemon, i) => (
            <PokeBall key={i} size={28} tone={pokemon?.fainted ? 'muted' : 'team'} />
          ))}
        </span>
      </header>

      {mon ? (
        <>
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <span className="truncate text-[44px] leading-tight font-extrabold">{mon.name}</span>
            <span className="shrink-0 text-2xl font-bold text-muted">
              {t('battle.level', { level: mon.level })}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <HpBar percent={mon.hp} className="h-6 flex-1" />
            <span className="w-24 text-right text-[30px] font-extrabold tabular-nums">
              {mon.hp}%
            </span>
          </div>
        </>
      ) : (
        <p className="mt-4 text-[30px] font-bold text-muted">…</p>
      )}

      <div className="mt-4 flex min-h-10 flex-wrap items-center gap-2.5 text-lg">
        {choosing && <StatusPill status="choosing" className="text-lg" />}
        {mon?.status && (
          <span className={`tag tag--${mon.status}`}>{t(`statuses.${mon.status}`)}</span>
        )}
        {mon?.mega && <span className="tag tag--mega">{t('battle.megaTag')}</span>}
        {boosts.map(([stat, value]) => (
          <span key={stat} className="tag">
            {t('host.battle.boost', {
              stat: t(`stats.${stat}`),
              amount: value > 0 ? `+${value}` : `${value}`,
            })}
          </span>
        ))}
        {state.conditions.map((condition) => (
          <span key={condition} className="tag">
            {condition}
          </span>
        ))}
      </div>
    </section>
  );
}
