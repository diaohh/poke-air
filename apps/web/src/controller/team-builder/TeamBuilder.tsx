import {
  toId,
  type PokemonSetData,
  type PublicPlayer,
  type PublicRoomState,
} from '@poke-air/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemIcon } from '../../components/ItemIcon';
import { PokemonSprite } from '../../components/PokemonSprite';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { IconButton } from '../../components/ui/IconButton';
import { PokeBall } from '../../components/ui/PokeBall';
import { useTeamDex } from '../../lib/team-dex';
import { useCountdown } from '../../lib/use-countdown';
import { useControllerStore } from '../controller-store';
import { ErrorNote } from './ErrorNote';
import { PokemonEditor } from './PokemonEditor';
import { TeamMenu } from './TeamMenu';

interface Props {
  room: PublicRoomState;
  me: PublicPlayer;
}

/**
 * Phone TEAM_BUILDING (Phase 2). Quota-sized list of slots: each Pokémon card opens the editor
 * (✏️) or is removed (✕); empty slots add a Pokémon by search or at random (🎲). Randomize fills the
 * empty slots (or rerolls the whole team when it is full). The Team menu imports / exports Showdown
 * text and keeps saved teams. Any change un-readies the player.
 */
export function TeamBuilder({ room, me }: Props) {
  const { t } = useTranslation();
  const { team, busy, error, errorParams, randomize, clearSlot, setReady, clearError, roomAt } =
    useControllerStore();
  const seconds = useCountdown(room.battleCountdownMs, roomAt);
  const [editing, setEditingSlot] = useState<number | null>(null);
  const [menuOpen, setMenuOpenState] = useState(false);
  // Errors belong to the view that caused them: start the editor and the menu clean.
  const setEditing = (slot: number | null) => {
    clearError();
    setEditingSlot(slot);
  };
  const setMenuOpen = (open: boolean) => {
    clearError();
    setMenuOpenState(open);
  };
  const [notice, setNotice] = useState<string | null>(null);
  // Start loading the dex while the player looks at the list (the editor needs it).
  const dexState = useTeamDex();
  const itemIcon = (item: string) =>
    dexState.status === 'ready' ? dexState.dex.itemById.get(toId(item))?.icon : undefined;

  const slots = team?.slots ?? Array.from({ length: me.quota }, () => null);
  const sets = slots.filter((set): set is PokemonSetData => !!set);
  const empty = slots.flatMap((set, i) => (set ? [] : [i]));
  const count = sets.length;

  if (editing !== null) {
    return (
      <PokemonEditor
        key={editing}
        slot={editing}
        initial={slots[editing] ?? null}
        otherSpecies={slots.flatMap((set, i) => (set && i !== editing ? [set.species] : []))}
        onDone={() => setEditing(null)}
      />
    );
  }

  const act = (action: () => Promise<unknown>) => {
    setNotice(null);
    void action();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[30px] leading-tight">{t('teamBuilder.title')}</h1>
        <span className="ml-auto text-[15px] font-extrabold text-(color:--deep)">
          {t('teamBuilder.count', { count, quota: slots.length })}
        </span>
        <IconButton
          icon="menu"
          label={t('teamBuilder.menu.title')}
          disabled={busy}
          onClick={() => setMenuOpen(true)}
          className="size-11 text-xl"
        />
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
              itemIcon={set.item ? itemIcon(set.item) : undefined}
              disabled={busy}
              onEdit={() => setEditing(slot)}
              onRemove={() => act(() => clearSlot(slot))}
            />
          ) : (
            <div key={`empty-${slot}`} className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(slot)}
                className="slot-empty flex min-h-[72px] flex-1 items-center justify-center gap-2.5 rounded-[22px] text-base font-extrabold"
              >
                <Icon name="plus" />
                {t('teamBuilder.addPokemon')}
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label={t('teamBuilder.addRandom')}
                title={t('teamBuilder.addRandom')}
                onClick={() => act(() => randomize([slot]))}
                className="slot-empty grid min-h-[72px] w-[72px] shrink-0 place-items-center rounded-[22px] text-2xl"
              >
                <Icon name="dice" />
              </button>
            </div>
          ),
        )}
      </div>

      {notice && !error && (
        <p role="status" className="text-center text-sm font-semibold text-ok-deep">
          {notice}
        </p>
      )}
      {!menuOpen && <ErrorNote error={error} params={errorParams} />}

      <Button
        variant="gold"
        disabled={busy}
        onClick={() => act(() => randomize(empty.length > 0 ? empty : undefined))}
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
        {count === 0 ? t('teamBuilder.emptyHint') : me.ready ? t('teamBuilder.waitingOthers') : ' '}
      </p>

      {menuOpen && <TeamMenu sets={sets} onClose={() => setMenuOpen(false)} onNotice={setNotice} />}
    </div>
  );
}

interface CardProps {
  set: PokemonSetData;
  itemIcon: number | undefined;
  disabled: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

/** Icon, name, @ item, ability, nature, the 4 moves (no type chips) + edit / remove. */
function PokemonCard({ set, itemIcon, disabled, onEdit, onRemove }: CardProps) {
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
