import { SIDE_TEAM } from '@poke-air/shared';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { TEAM_SCOPE } from '../../lib/team';
import { NarrationText } from './NarrationText';
import type { LogTurn } from './playback';

/**
 * Showdown-style battle log (roadmap § Quick wins): everything narrated so far, grouped by turn,
 * each line dotted with the acting side's team color. Follows the playback, so it never spoils the
 * turn being animated; auto-scrolls to the newest line.
 */
export function BattleLog({ log }: { log: LogTurn[] }) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const lastId = log.at(-1)?.lines.at(-1)?.id ?? log.length;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  return (
    <aside
      aria-label={t('host.battle.log.title')}
      className="battle-log row-span-2 flex min-h-0 flex-col rounded-xl"
    >
      <header className="flex items-baseline justify-between px-7 pt-6 pb-3">
        <h2 className="font-display text-[34px] leading-none">{t('host.battle.log.title')}</h2>
        <span className="text-lg font-bold text-muted">{t('host.battle.log.hideHint')}</span>
      </header>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-7 pb-7">
        {log.map((group) => (
          <section key={group.turn} className="mt-4 first:mt-1">
            <h3 className="battle-log__turn text-[26px]">
              {group.turn === 0
                ? t('host.battle.log.start')
                : t('host.battle.turn', { turn: group.turn })}
            </h3>
            <ul className="mt-2 flex flex-col gap-2">
              {group.lines.map((line) => (
                <li
                  key={line.id}
                  className={cn(
                    'battle-log__line flex gap-3 text-[22px] leading-snug font-semibold text-ink-2',
                    line.side && TEAM_SCOPE[SIDE_TEAM[line.side]],
                    line.id === lastId && 'text-ink',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn('battle-log__dot', !line.side && 'invisible')}
                  />
                  <span className="min-w-0">
                    <NarrationText line={line} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
