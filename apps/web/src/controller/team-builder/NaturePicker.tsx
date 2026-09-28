import type { DexNature, DexSpecies, StatId, StatTable } from '@poke-air/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { cn } from '../../lib/cn';
import { calcStat } from '../../lib/stats';
import { NavRow } from './NavRow';

/** Stats a nature can raise or lower (never HP). */
const NATURE_STATS = ['atk', 'def', 'spa', 'spd', 'spe'] as const satisfies readonly StatId[];
type NatureStat = (typeof NATURE_STATS)[number];

/** Used when both picks are the same stat: every neutral nature has the same effect. */
const DEFAULT_NEUTRAL = 'Hardy';

interface Props {
  natures: DexNature[];
  current: DexNature | undefined;
  species: DexSpecies;
  points: StatTable;
  onPick: (nature: DexNature) => void;
  onClose: () => void;
}

/**
 * Nature by effect instead of by name: the player picks the stat to raise (▲ green) and the stat
 * to lower (▼ red); the matching nature appears with what it does to this Pokémon's stats, and is
 * applied on confirm. The same stat twice = a neutral nature.
 */
export function NaturePicker({ natures, current, species, points, onPick, onClose }: Props) {
  const { t } = useTranslation();
  const neutralNow = current && !current.plus;
  const [plus, setPlus] = useState<NatureStat | null>(
    (current?.plus as NatureStat | undefined) ?? null,
  );
  const [minus, setMinus] = useState<NatureStat | null>(
    (current?.minus as NatureStat | undefined) ?? null,
  );
  const [neutral, setNeutral] = useState(Boolean(neutralNow));

  const result: DexNature | undefined = neutral
    ? neutralNow
      ? current
      : natures.find((n) => n.name === DEFAULT_NEUTRAL)
    : plus && minus
      ? plus === minus
        ? (natures.find((n) => n.name === DEFAULT_NEUTRAL) ?? natures.find((n) => !n.plus))
        : natures.find((n) => n.plus === plus && n.minus === minus)
      : undefined;
  const isNeutral = Boolean(result && !result.plus);

  const choose = (row: 'plus' | 'minus', stat: NatureStat) => {
    setNeutral(false);
    if (row === 'plus') setPlus(stat);
    else setMinus(stat);
  };

  const statRow = (row: 'plus' | 'minus') => {
    const selected = row === 'plus' ? plus : minus;
    return (
      <section className="phone-card flex flex-col gap-2.5 rounded-[22px] p-3.5">
        <h3 className="field-label flex items-center gap-1.5 text-xs">
          <span className={row === 'plus' ? 'text-ok-deep' : 'text-team-red-deep'}>
            {row === 'plus' ? '▲' : '▼'}
          </span>
          {t(
            row === 'plus'
              ? 'teamBuilder.natureSelector.raise'
              : 'teamBuilder.natureSelector.lower',
          )}
        </h3>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup">
          {NATURE_STATS.map((stat) => {
            const on = !neutral && selected === stat;
            return (
              <button
                key={stat}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => choose(row, stat)}
                className={cn(
                  'nature-stat flex min-h-14 flex-col items-center justify-center rounded-2xl text-sm font-extrabold',
                  on && `nature-stat--${row === 'plus' ? 'up' : 'down'}`,
                )}
              >
                <span className="text-[11px]">{on ? (row === 'plus' ? '▲' : '▼') : ' '}</span>
                {t(`statsShort.${stat}`)}
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  /** "Atk 182 → 200" for the two stats the nature changes, with this Pokémon's Stat Points. */
  const preview = (stat: NatureStat) => {
    const base = species.baseStats[stat];
    return {
      before: calcStat(stat, base, points[stat], undefined),
      after: calcStat(stat, base, points[stat], result),
    };
  };

  return (
    <div className="picker fixed inset-0 z-30 mx-auto flex max-w-md flex-col gap-3 px-4.5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <NavRow title={t('teamBuilder.picker.nature')} onBack={onClose} />
      <div className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1.5 pt-1 pb-2">
        {statRow('plus')}
        {statRow('minus')}
        <button
          type="button"
          role="switch"
          aria-checked={neutral}
          onClick={() => setNeutral((on) => !on)}
          className={cn(
            'choice-chip justify-center self-center rounded-full px-4 py-2.5 text-sm font-extrabold',
            neutral && 'choice-chip--on',
          )}
        >
          {neutral && <Icon name="check" />}
          {t('teamBuilder.natureSelector.neutral')}
        </button>
        <p className="text-center text-[13px] font-semibold text-ink-2">
          {t('teamBuilder.natureSelector.hint')}
        </p>

        <section
          aria-live="polite"
          className="phone-card flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-[22px] p-4 text-center"
        >
          {result ? (
            <>
              <span className="field-label text-[11px]">
                {t('teamBuilder.natureSelector.result')}
              </span>
              <strong className="font-display text-[34px] leading-tight">{result.name}</strong>
              {isNeutral || !result.plus || !result.minus ? (
                <span className="text-sm font-bold text-ink-2">
                  {t('teamBuilder.natureSelector.neutralEffect')}
                </span>
              ) : (
                <span className="flex flex-wrap justify-center gap-2 text-sm font-extrabold">
                  {[result.plus, result.minus].map((stat, i) => {
                    const { before, after } = preview(stat as NatureStat);
                    return (
                      <span
                        key={stat}
                        className={cn(
                          'stat-box rounded-full px-3 py-1 tabular-nums',
                          i === 0 ? 'stat-box--up' : 'stat-box--down',
                        )}
                      >
                        {i === 0 ? '▲' : '▼'} {t(`statsShort.${stat}`)} {before} → {after}
                      </span>
                    );
                  })}
                </span>
              )}
            </>
          ) : (
            <span className="text-[15px] font-semibold text-ink-2">
              {t('teamBuilder.natureSelector.pickBoth')}
            </span>
          )}
        </section>
      </div>
      <Button
        variant="primary"
        disabled={!result}
        onClick={() => result && onPick(result)}
        className="min-h-15 text-[19px]"
      >
        <Icon name="check" />
        {result
          ? t('teamBuilder.natureSelector.confirm', { nature: result.name })
          : t('teamBuilder.natureSelector.confirmEmpty')}
      </Button>
    </div>
  );
}
