import type { PokemonSetData, PublicPlayer, PublicRoomState } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { PokemonSprite } from '../../components/PokemonSprite';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { IconButton } from '../../components/ui/IconButton';
import { PokeBall } from '../../components/ui/PokeBall';
import { useCountdown } from '../../lib/use-countdown';
import { useControllerStore } from '../controller-store';

interface Props {
  room: PublicRoomState;
  me: PublicPlayer;
}

/**
 * Phone TEAM_BUILDING (Phase 1: randomizer only). Quota-sized list of slots: each Pokémon card has
 * reroll + remove; empty slots add a random Pokémon. Randomize fills the empty slots (or rerolls
 * the whole team when it is full). Any change un-readies the player.
 */
export function TeamBuilder({ room, me }: Props) {
  const { t } = useTranslation();
  const { team, busy, error, randomize, clearSlot, setReady, roomAt } = useControllerStore();
  const seconds = useCountdown(room.battleCountdownMs, roomAt);
  const slots = team?.slots ?? Array.from({ length: me.quota }, () => null);
  const empty = slots.flatMap((set, i) => (set ? [] : [i]));
  const count = slots.length - empty.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-[30px] leading-tight">{t('teamBuilder.title')}</h1>
        <span className="text-[15px] font-extrabold text-(color:--deep)">
          {t('teamBuilder.count', { count, quota: slots.length })}
        </span>
      </div>

      {seconds !== null && (
        <p
          role="timer"
          className="flex items-center justify-center gap-2.5 rounded-md bg-gold-soft px-3.5 py-2.5 text-base font-extrabold text-wine"
        >
          <PokeBall size={22} tone="brand" animation="wobble" />
          {t('teamBuilder.countdown', { seconds: Math.max(1, seconds) })}
        </p>
      )}

      <div className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1.5 pt-1 pb-2.5">
        {slots.map((set, slot) =>
          set ? (
            <PokemonCard
              key={`${slot}-${set.species}`}
              set={set}
              disabled={busy}
              onReroll={() => void randomize([slot])}
              onRemove={() => void clearSlot(slot)}
            />
          ) : (
            <button
              key={`empty-${slot}`}
              type="button"
              disabled={busy}
              onClick={() => void randomize([slot])}
              className="slot-empty flex min-h-[72px] shrink-0 items-center justify-center gap-2.5 rounded-[22px] text-base font-extrabold"
            >
              <Icon name="dice" />
              {t('teamBuilder.addRandom')}
            </button>
          ),
        )}
      </div>

      {error && (
        <p role="alert" className="text-center text-sm font-semibold text-warn-deep">
          {t(`errors.${error}`)}
        </p>
      )}

      <Button
        variant="gold"
        disabled={busy}
        onClick={() => void randomize(empty.length > 0 ? empty : undefined)}
        className="min-h-13.5 w-full rounded-md text-[17px]"
      >
        <Icon name="dice" />
        {empty.length > 0 ? t('teamBuilder.fillRandom') : t('teamBuilder.randomizeAll')}
      </Button>

      {me.ready ? (
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void setReady(false)}
          className="min-h-15 w-full text-[19px]"
        >
          <Icon name="check" />
          {t('teamBuilder.editAgain')}
        </Button>
      ) : (
        <Button
          variant="ok"
          disabled={busy || count === 0}
          onClick={() => void setReady(true)}
          className="min-h-15 w-full text-[19px]"
        >
          <Icon name="check" />
          {t('teamBuilder.ready')}
        </Button>
      )}
      <p role="status" className="text-center text-[13px] font-semibold text-ink-2">
        {count === 0 ? t('teamBuilder.emptyHint') : me.ready ? t('teamBuilder.waitingOthers') : ' '}
      </p>
    </div>
  );
}

interface CardProps {
  set: PokemonSetData;
  disabled: boolean;
  onReroll: () => void;
  onRemove: () => void;
}

/** Icon, name, @ item, ability, nature, the 4 moves (no type chips) + reroll / remove. */
function PokemonCard({ set, disabled, onReroll, onRemove }: CardProps) {
  const { t } = useTranslation();
  return (
    <article className="phone-card shrink-0 rounded-[22px] p-3 pb-3.5">
      <div className="flex items-center gap-3">
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-(color:--tint)">
          <PokemonSprite species={set.species} decorative fit />
        </div>
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-lg font-extrabold">{set.species}</strong>
          <span className="block truncate text-[13px] text-ink-2">
            {set.item ? t('teamBuilder.item', { item: set.item }) : t('teamBuilder.noItem')}
          </span>
        </div>
        <div className="flex gap-1.5">
          <IconButton
            icon="dice"
            label={t('teamBuilder.reroll', { name: set.species })}
            disabled={disabled}
            onClick={onReroll}
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
