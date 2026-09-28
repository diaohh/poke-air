import {
  STAT_IDS,
  STAT_POINTS_MAX,
  STAT_POINTS_TOTAL,
  type DexNature,
  type DexSpecies,
  type StatId,
  type StatTable,
} from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { calcStats, maxPointsFor, totalPoints } from '../../lib/stats';

interface Props {
  species: DexSpecies;
  points: StatTable;
  nature: DexNature | undefined;
  onChange: (points: StatTable) => void;
}

/**
 * Champions Stat Points: 66 in total, 32 at most per stat (docs/05). Each row: stat, base value,
 * − / + stepper and a slider for big jumps, and the resulting Lv 50 stat. The nature's raised stat
 * is green with ▲, the lowered one red with ▼ (icon + color).
 */
export function StatPointsEditor({ species, points, nature, onChange }: Props) {
  const { t } = useTranslation();
  const used = totalPoints(points);
  const stats = calcStats(species, points, nature);

  const set = (stat: StatId, value: number) => {
    const next = Math.max(0, Math.min(maxPointsFor(points, stat), Math.round(value)));
    if (next !== points[stat]) onChange({ ...points, [stat]: next });
  };

  return (
    <section className="phone-card flex flex-col gap-2.5 rounded-[22px] p-3.5">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="field-label text-xs">{t('teamBuilder.editor.statPoints')}</h3>
        <span
          className={cn(
            'text-sm font-extrabold tabular-nums',
            used === STAT_POINTS_TOTAL ? 'text-ok-deep' : 'text-ink-2',
          )}
        >
          {t('teamBuilder.editor.pointsLeft', {
            left: STAT_POINTS_TOTAL - used,
            total: STAT_POINTS_TOTAL,
          })}
        </span>
      </header>
      {STAT_IDS.map((stat) => {
        const mark = nature?.plus === stat ? 'up' : nature?.minus === stat ? 'down' : null;
        const max = maxPointsFor(points, stat);
        return (
          <div
            key={stat}
            className="grid grid-cols-[2.6rem_2.25rem_1.75rem_2.25rem_minmax(0,1fr)_2.9rem] items-center gap-1.5"
          >
            <span className="flex flex-col leading-tight">
              <b className="text-[13px] font-extrabold">{t(`statsShort.${stat}`)}</b>
              <small className="text-[11px] font-semibold text-muted tabular-nums">
                {species.baseStats[stat]}
              </small>
            </span>
            <button
              type="button"
              aria-label={t('teamBuilder.editor.lessPoints', { stat: t(`statsShort.${stat}`) })}
              disabled={points[stat] === 0}
              onClick={() => set(stat, points[stat] - 1)}
              className="sp-step size-9 rounded-xl text-lg font-extrabold"
            >
              −
            </button>
            <span className="text-center text-[15px] font-extrabold tabular-nums">
              {points[stat]}
            </span>
            <button
              type="button"
              aria-label={t('teamBuilder.editor.morePoints', { stat: t(`statsShort.${stat}`) })}
              disabled={points[stat] >= max}
              onClick={() => set(stat, points[stat] + 1)}
              className="sp-step size-9 rounded-xl text-lg font-extrabold"
            >
              +
            </button>
            <input
              type="range"
              min={0}
              max={STAT_POINTS_MAX}
              step={1}
              value={points[stat]}
              aria-label={t(`stats.${stat}`)}
              onChange={(event) => set(stat, Number(event.target.value))}
              className="sp-slider w-full"
            />
            <span
              className={cn(
                'stat-box rounded-lg px-1 py-1 text-right text-[15px] font-extrabold tabular-nums',
                mark && `stat-box--${mark}`,
              )}
            >
              {mark && <span className="mr-0.5 text-[10px]">{mark === 'up' ? '▲' : '▼'}</span>}
              {stats[stat]}
            </span>
          </div>
        );
      })}
    </section>
  );
}
