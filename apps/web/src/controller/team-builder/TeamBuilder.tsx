import {
  toId,
  type PokemonSetData,
  type PublicPlayer,
  type PublicRoomState,
} from '@poke-air/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { IconButton } from '../../components/ui/IconButton';
import { PokeBall } from '../../components/ui/PokeBall';
import { useTeamDex } from '../../lib/team-dex';
import { useCountdown } from '../../lib/use-countdown';
import { useControllerStore } from '../controller-store';
import { ErrorNote } from './ErrorNote';
import { PokemonCard } from './PokemonCard';
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
  const {
    team,
    busy,
    error,
    errorParams,
    randomize,
    clearSlot,
    saveSlot,
    randomSet,
    setReady,
    clearError,
    roomAt,
  } = useControllerStore();
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
  // Doubles: a side needs two Pokémon, so a solo player brings at least 2 (decision D-44).
  const minimum = team?.minimum ?? 1;

  if (editing !== null) {
    return (
      <PokemonEditor
        key={editing}
        initial={slots[editing] ?? null}
        otherSpecies={slots.flatMap((set, i) => (set && i !== editing ? [set.species] : []))}
        onDone={() => setEditing(null)}
        onSave={(set) => saveSlot(editing, set)}
        onRemove={() => clearSlot(editing)}
        onRandomSet={randomSet}
        busy={busy}
        error={error}
        errorParams={errorParams}
        clearError={clearError}
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
          disabled={busy || count < minimum}
          onClick={() => void setReady(true)}
          className="min-h-15 w-full text-[19px]"
        >
          <Icon name="check" />
          {t('teamBuilder.ready')}
        </Button>
      )}
      <p role="status" className="text-center text-[13px] font-semibold text-ink-2">
        {count < minimum
          ? minimum > 1
            ? t('teamBuilder.minimumHint', { count: minimum })
            : t('teamBuilder.emptyHint')
          : me.ready
            ? t('teamBuilder.waitingOthers')
            : ' '}
      </p>

      {menuOpen && (
        <TeamMenu
          sets={sets}
          quota={slots.length}
          onClose={() => setMenuOpen(false)}
          onNotice={setNotice}
        />
      )}
    </div>
  );
}
