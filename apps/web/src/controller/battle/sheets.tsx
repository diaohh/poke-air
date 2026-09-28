import {
  STAT_IDS,
  STAT_POINTS_MAX,
  type BattleMoveOption,
  type BattlePokemon,
  type BoostId,
  type StatId,
} from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { ItemIcon } from '../../components/ItemIcon';
import { Button } from '../../components/ui/Button';
import { HpBar } from '../../components/ui/HpBar';
import { Sheet } from '../../components/ui/Sheet';
import { cn } from '../../lib/cn';
import { isLightType, typeStyle } from '../../lib/pokemon-types';

export function TypeChip({ type, className }: { type: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn('type-chip', isLightType(type) && 'type-chip--light', className)}
      style={typeStyle(type)}
    >
      {t(`types.${type as 'Normal'}`, { defaultValue: type })}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-box rounded-[14px] p-2.5 text-center">
      <small className="block text-[11px] font-extrabold tracking-widest text-muted uppercase">
        {label}
      </small>
      <b className="text-xl font-extrabold">{value}</b>
    </div>
  );
}

interface MoveSheetProps {
  move: BattleMoveOption;
  onClose: () => void;
  onUse: () => void;
}

/** Type, category, power, accuracy, PP, description + "Use move". */
export function MoveSheet({ move, onClose, onUse }: MoveSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet title={move.name} onClose={onClose}>
      <div className="flex flex-wrap gap-1.5">
        <TypeChip type={move.type} className="px-3 py-1.5 text-xs" />
        <span className="rounded-full bg-paper-2 px-3 py-1.5 text-xs font-extrabold text-ink-2">
          {t(`battle.categories.${move.category}`)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t('battle.power')} value={move.basePower || '—'} />
        <Stat
          label={t('battle.accuracy')}
          value={move.accuracy === true ? '—' : `${move.accuracy}%`}
        />
        <Stat label={t('battle.pp')} value={move.maxpp ? `${move.pp}/${move.maxpp}` : '—'} />
      </div>
      {move.description && (
        <p className="text-[15px] leading-normal text-ink-2">{move.description}</p>
      )}
      <div className="sheet__actions">
        <Button variant="ghost" onClick={onClose} className="min-h-13.5 text-[17px]">
          {t('common.close')}
        </Button>
        <Button
          variant="primary"
          disabled={move.disabled}
          onClick={onUse}
          className="min-h-13.5 text-[17px]"
        >
          {t('battle.useMove')}
        </Button>
      </div>
    </Sheet>
  );
}

interface PokemonSheetProps {
  pokemon: BattlePokemon;
  canSwitch: boolean;
  onClose: () => void;
  onSwitch: () => void;
}

/** Nature effect on one stat: raised (▲) or lowered (▼). */
function natureMark(pokemon: BattlePokemon, stat: StatId): 'up' | 'down' | null {
  if (pokemon.nature?.plus === stat) return 'up';
  if (pokemon.nature?.minus === stat) return 'down';
  return null;
}

/**
 * One row per stat: name, computed value and a bar with the Stat Points invested in it (0–32), so
 * the player sees where the build is focused. The stat the nature raises is green with ▲, the
 * lowered one red with ▼ (state = icon + color, never color alone); neutral natures mark nothing.
 */
export function StatGrid({ pokemon }: { pokemon: BattlePokemon }) {
  const { t } = useTranslation();
  const points = pokemon.statPoints;
  return (
    <div className="flex flex-col gap-1.5">
      {points && (
        <div className="flex justify-between px-2.5 text-[11px] font-extrabold tracking-widest text-muted uppercase">
          <span>{t('battle.statsTitle')}</span>
          <span>{t('battle.statPointsTitle')}</span>
        </div>
      )}
      {STAT_IDS.map((stat) => {
        const mark = natureMark(pokemon, stat);
        const invested = points?.[stat] ?? 0;
        return (
          <div
            key={stat}
            className={cn(
              'stat-box grid grid-cols-[2.8rem_3.2rem_minmax(0,1fr)_2rem] items-center gap-2 rounded-[14px] px-2.5 py-1.5',
              mark && `stat-box--${mark}`,
            )}
          >
            <small className="text-[12px] font-extrabold tracking-widest uppercase">
              {mark && (
                <span
                  className="mr-0.5 text-[10px]"
                  aria-label={t(`battle.nature${mark === 'up' ? 'Up' : 'Down'}`)}
                >
                  {mark === 'up' ? '▲' : '▼'}
                </span>
              )}
              {t(`statsShort.${stat}`)}
            </small>
            <b className="text-right text-lg font-extrabold tabular-nums">{pokemon.stats[stat]}</b>
            {points ? (
              <>
                <span
                  className="sp-bar h-2.5 rounded-full"
                  role="meter"
                  aria-label={t('battle.statPointsOf', { stat: t(`stats.${stat}`) })}
                  aria-valuemin={0}
                  aria-valuemax={STAT_POINTS_MAX}
                  aria-valuenow={invested}
                >
                  <span
                    className="sp-bar__fill block h-full rounded-full"
                    style={{ width: `${(invested / STAT_POINTS_MAX) * 100}%` }}
                  />
                </span>
                <span className="text-right text-xs font-extrabold tabular-nums">
                  {invested > 0 ? `+${invested}` : '0'}
                </span>
              </>
            ) : (
              <span className="col-span-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Item, ability, nature, HP, stats (+ stat stages when active), moves + "Switch in". */
export function PokemonSheet({ pokemon, canSwitch, onClose, onSwitch }: PokemonSheetProps) {
  const { t } = useTranslation();
  const percent = pokemon.maxhp ? (pokemon.hp / pokemon.maxhp) * 100 : 0;
  const boosts = Object.entries(pokemon.boosts ?? {}) as [BoostId, number][];
  const label = pokemon.active
    ? t('battle.inBattle')
    : pokemon.fainted
      ? t('battle.fainted')
      : t('battle.switchIn');

  return (
    <Sheet title={pokemon.name} onClose={onClose}>
      <HpBar percent={percent} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[15px]">
        <dt className="self-center text-xs font-extrabold tracking-widest text-muted uppercase">
          {t('battle.item')}
        </dt>
        <dd className="flex items-center gap-1.5 font-bold">
          {pokemon.item && <ItemIcon icon={pokemon.itemIcon} />}
          {pokemon.item || '—'}
        </dd>
        <dt className="self-center text-xs font-extrabold tracking-widest text-muted uppercase">
          {t('battle.ability')}
        </dt>
        <dd className="font-bold">{pokemon.ability}</dd>
        <dt className="self-center text-xs font-extrabold tracking-widest text-muted uppercase">
          {t('battle.hp')}
        </dt>
        <dd className="font-bold">
          {t('battle.hpValue', { hp: pokemon.hp, maxhp: pokemon.maxhp })}
        </dd>
        {pokemon.nature && (
          <>
            <dt className="self-center text-xs font-extrabold tracking-widest text-muted uppercase">
              {t('battle.nature')}
            </dt>
            <dd className="font-bold">
              {pokemon.nature.plus && pokemon.nature.minus
                ? t('battle.natureEffect', {
                    nature: pokemon.nature.name,
                    plus: t(`statsShort.${pokemon.nature.plus}`),
                    minus: t(`statsShort.${pokemon.nature.minus}`),
                  })
                : t('battle.natureNeutral', { nature: pokemon.nature.name })}
            </dd>
          </>
        )}
      </dl>
      <StatGrid pokemon={pokemon} />
      {boosts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="field-label text-[11px]">{t('battle.statStages')}</span>
          {boosts.map(([stat, value]) => (
            <span key={stat} className={cn('tag text-[11px]', value > 0 ? 'tag--up' : 'tag--down')}>
              {value > 0 ? '▲' : '▼'}{' '}
              {t('battle.boost', {
                stat: t(`boostsShort.${stat}`),
                amount: value > 0 ? `+${value}` : `${value}`,
              })}
            </span>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-1.5">
        {pokemon.moves.map((move) => (
          <li
            key={move.id}
            style={typeStyle(move.type)}
            className={cn(
              'type-chip justify-between rounded-xl px-2.5 py-2 text-[13px] tracking-normal normal-case',
              isLightType(move.type) && 'type-chip--light',
            )}
          >
            {move.name}
          </li>
        ))}
      </ul>
      <div className="sheet__actions">
        <Button variant="ghost" onClick={onClose} className="min-h-13.5 text-[17px]">
          {t('common.close')}
        </Button>
        <Button
          variant="primary"
          disabled={!canSwitch}
          onClick={onSwitch}
          className="min-h-13.5 text-[17px]"
        >
          {label}
        </Button>
      </div>
    </Sheet>
  );
}

interface ForfeitSheetProps {
  /** The player has a teammate: forfeiting ends the battle for both (decision D-47). */
  team?: boolean;
  onClose: () => void;
  onForfeit: () => void;
}

export function ForfeitSheet({ team, onClose, onForfeit }: ForfeitSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet title={t('battle.forfeitTitle')} onClose={onClose}>
      <p className="text-[15px] leading-normal text-ink-2">
        {team ? t('battle.forfeitBodyTeam') : t('battle.forfeitBody')}
      </p>
      <div className="sheet__actions">
        <Button variant="ghost" onClick={onClose} className="min-h-13.5 text-[17px]">
          {t('battle.keepPlaying')}
        </Button>
        <Button variant="primary" onClick={onForfeit} className="min-h-13.5 text-[17px]">
          {t('battle.forfeit')}
        </Button>
      </div>
    </Sheet>
  );
}
