import type { PokemonSetData } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { ItemIcon } from '../../components/ItemIcon';
import { PokemonSprite } from '../../components/PokemonSprite';
import { IconButton } from '../../components/ui/IconButton';

interface CardProps {
  set: PokemonSetData;
  itemIcon: number | undefined;
  disabled: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

/** Icon, name, @ item, ability, nature, the 4 moves (no type chips) + edit / remove. */
export function PokemonCard({ set, itemIcon, disabled, onEdit, onRemove }: CardProps) {
  const { t } = useTranslation();
  return (
    <article className="phone-card shrink-0 rounded-[22px] p-3 pb-3.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={onEdit}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-(color:--tint)">
            <PokemonSprite species={set.species} decorative fit />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-lg font-extrabold">{set.species}</strong>
            <span className="flex min-w-0 items-center gap-1 text-[13px] text-ink-2">
              <ItemIcon icon={itemIcon} />
              <span className="truncate">
                {set.item ? t('teamBuilder.item', { item: set.item }) : t('teamBuilder.noItem')}
              </span>
            </span>
          </span>
        </button>
        <div className="flex gap-1.5">
          <IconButton
            icon="edit"
            label={t('teamBuilder.edit', { name: set.species })}
            disabled={disabled}
            onClick={onEdit}
            className="size-10 text-lg"
          />
          <IconButton
            icon="x"
            danger
            label={t('teamBuilder.remove', { name: set.species })}
            disabled={disabled}
            onClick={onRemove}
            className="size-10 text-lg"
          />
        </div>
      </div>
      <div className="mt-2.5 mb-2 flex flex-wrap gap-1.5 text-xs">
        <span className="mon-card__chip rounded-full px-2.5 py-1 font-semibold">
          {t('teamBuilder.ability')} <b className="font-extrabold">{set.ability}</b>
        </span>
        {set.nature && (
          <span className="mon-card__chip rounded-full px-2.5 py-1 font-semibold">
            {t('teamBuilder.nature')} <b className="font-extrabold">{set.nature}</b>
          </span>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-1.5">
        {set.moves.map((move) => (
          <li
            key={move}
            className="mon-card__move truncate rounded-[10px] px-2.5 py-1.75 text-[13px] font-bold"
          >
            {move}
          </li>
        ))}
      </ul>
    </article>
  );
}
