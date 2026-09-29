import type { TeamTextBlock } from '@poke-air/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PokemonSprite } from '../../components/PokemonSprite';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { cn } from '../../lib/cn';
import { useDexNames } from '../../lib/dex-names';

interface Props {
  /** The team's Pokémon, one Showdown text block each (`splitTeamText`). */
  blocks: TeamTextBlock[];
  /** Slots available (the room quota, or 6 outside a room). */
  max: number;
  busy?: boolean;
  onBack: () => void;
  /** The chosen blocks joined back into team text. */
  onConfirm: (text: string) => void;
}

/**
 * "This team has 6 Pokémon, you can bring 3": the player picks which ones to keep before the team
 * is imported (decision D-54). The first `max` start selected. Sheet content (no sheet of its own).
 */
export function KeepPicker({ blocks, max, busy, onBack, onConfirm }: Props) {
  const { t } = useTranslation();
  const names = useDexNames();
  const [picked, setPicked] = useState<number[]>(() => blocks.slice(0, max).map((_, i) => i));

  const toggle = (index: number) =>
    setPicked((current) =>
      current.includes(index)
        ? current.filter((i) => i !== index)
        : current.length < max
          ? [...current, index]
          : current,
    );

  return (
    <>
      <p className="text-sm font-semibold text-ink-2">
        {t('teamBuilder.keep.hint', { count: blocks.length, max })}
      </p>
      <p className="field-label text-xs">
        {t('teamBuilder.keep.selected', { count: picked.length, max })}
      </p>
      <ul className="flex flex-col gap-2">
        {blocks.map((block, index) => {
          const on = picked.includes(index);
          const full = !on && picked.length >= max;
          return (
            <li key={index}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={full}
                onClick={() => toggle(index)}
                className={cn(
                  'picker-row flex min-h-14 w-full items-center gap-3 rounded-[18px] px-3 py-2 text-left',
                  on && 'choice-chip--on',
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden">
                  <PokemonSprite species={block.species} decorative fit />
                </span>
                <strong className="min-w-0 flex-1 truncate text-base font-extrabold">
                  {names.species(block.species)}
                </strong>
                {on && <Icon name="check" className="size-5 shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="sheet__actions">
        <Button variant="ghost" onClick={onBack} className="min-h-13.5 text-[17px]">
          {t('common.back')}
        </Button>
        <Button
          variant="primary"
          disabled={busy || picked.length === 0}
          onClick={() =>
            onConfirm(
              picked
                .slice()
                .sort((a, b) => a - b)
                .map((i) => blocks[i]?.text ?? '')
                .join('\n\n'),
            )
          }
          className="min-h-13.5 text-[17px]"
        >
          {t('teamBuilder.keep.confirm', { count: picked.length })}
        </Button>
      </div>
    </>
  );
}
