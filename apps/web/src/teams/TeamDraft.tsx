import { formatTeamText, POKEMON_PER_TEAM, toId, type PokemonSetData } from '@poke-air/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Sheet } from '../components/ui/Sheet';
import { ErrorNote } from '../controller/team-builder/ErrorNote';
import { NavRow } from '../controller/team-builder/NavRow';
import { PokemonCard } from '../controller/team-builder/PokemonCard';
import { PokemonEditor } from '../controller/team-builder/PokemonEditor';
import { saveTeam } from '../lib/saved-teams';
import { useTeamDex } from '../lib/team-dex';
import { useTeamsStore } from './teams-store';

/** A team being built on `/teams`: a saved team (`id`) or a new one. */
export interface Draft {
  id?: string;
  name: string;
  sets: PokemonSetData[];
}

interface Props {
  draft: Draft;
  /** Back to the list; `savedName` when the team was just saved. */
  onExit: (savedName?: string) => void;
}

/**
 * One team on the standalone team builder: its name, up to 6 Pokémon (edit / remove, add by search
 * or at random), export as text and Save to this phone. Every set is validated on the server
 * (`builder:validateSet`) before it joins the draft, like in a room.
 */
export function TeamDraft({ draft, onExit }: Props) {
  const { t } = useTranslation();
  const store = useTeamsStore();
  const { busy, error, errorParams, clearError } = store;
  const dexState = useTeamDex();
  const [name, setName] = useState(draft.name);
  const [sets, setSets] = useState(draft.sets);
  const [dirty, setDirty] = useState(false);
  /** Slot being edited (`sets.length` = a new Pokémon). */
  const [editing, setEditingSlot] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'export' | 'discard' | null>(null);
  const [copied, setCopied] = useState(false);

  const itemIcon = (item: string) =>
    dexState.status === 'ready' ? dexState.dex.itemById.get(toId(item))?.icon : undefined;
  const change = (next: PokemonSetData[]) => {
    setSets(next);
    setDirty(true);
  };
  const setEditing = (slot: number | null) => {
    clearError();
    setEditingSlot(slot);
  };

  if (editing !== null) {
    return (
      <PokemonEditor
        key={editing}
        initial={sets[editing] ?? null}
        otherSpecies={sets.flatMap((set, i) => (i !== editing ? [set.species] : []))}
        onDone={() => setEditing(null)}
        onSave={async (set) => {
          const valid = await store.validateSet(set);
          if (!valid) return false;
          const next = [...sets];
          next[editing] = valid;
          change(next);
          return true;
        }}
        {...(editing < sets.length
          ? {
              onRemove: async () => {
                change(sets.filter((_, i) => i !== editing));
              },
            }
          : {})}
        onRandomSet={(species) => store.randomSet({ species })}
        busy={busy}
        error={error}
        errorParams={errorParams}
        clearError={clearError}
      />
    );
  }

  const addRandom = async () => {
    const set = await store.randomSet({ exclude: sets.map((s) => s.species) });
    if (set) change([...sets, set]);
  };
  const save = () => {
    const teamName = name.trim();
    saveTeam(
      teamName,
      formatTeamText(sets),
      sets.map((set) => set.species),
      draft.id,
    );
    onExit(teamName);
  };
  const exported = sets.length > 0 ? formatTeamText(sets) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exported);
      setCopied(true);
    } catch {
      // Clipboard blocked (plain http on a LAN IP): the text stays selectable in the box.
      setCopied(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <NavRow
        title={draft.id ? t('myTeams.editTitle') : t('myTeams.newTitle')}
        onBack={() => (dirty ? setSheet('discard') : onExit())}
      />
      <label className="flex flex-col gap-1.5">
        <span className="field-label text-xs">{t('teamBuilder.menu.teamName')}</span>
        <input
          value={name}
          maxLength={30}
          onChange={(event) => {
            setName(event.target.value);
            setDirty(true);
          }}
          className="field min-h-13 px-4 text-[17px]"
        />
      </label>
      <p className="text-right text-[15px] font-extrabold text-(color:--deep)">
        {t('teamBuilder.count', { count: sets.length, quota: POKEMON_PER_TEAM })}
      </p>

      <div className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1.5 pt-1 pb-2.5">
        {sets.map((set, slot) => (
          <PokemonCard
            key={`${slot}-${set.species}`}
            set={set}
            itemIcon={set.item ? itemIcon(set.item) : undefined}
            disabled={busy}
            onEdit={() => setEditing(slot)}
            onRemove={() => change(sets.filter((_, i) => i !== slot))}
          />
        ))}
        {sets.length < POKEMON_PER_TEAM && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(sets.length)}
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
              onClick={() => void addRandom()}
              className="slot-empty grid min-h-[72px] w-[72px] shrink-0 place-items-center rounded-[22px] text-2xl"
            >
              <Icon name="dice" />
            </button>
          </div>
        )}
      </div>

      <ErrorNote error={error} params={errorParams} />
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Button
          variant="ghost"
          disabled={sets.length === 0}
          onClick={() => setSheet('export')}
          className="min-h-15 px-4.5 text-base"
        >
          <Icon name="copy" />
          <span className="sr-only">{t('teamBuilder.menu.export')}</span>
        </Button>
        <Button
          variant="primary"
          disabled={busy || sets.length === 0 || !name.trim()}
          onClick={save}
          className="min-h-15 text-[19px]"
        >
          <Icon name="save" />
          {t('teamBuilder.menu.saveButton')}
        </Button>
      </div>

      {sheet === 'export' && (
        <Sheet title={t('teamBuilder.menu.export')} onClose={() => setSheet(null)}>
          <textarea
            readOnly
            value={exported}
            rows={10}
            onFocus={(event) => event.target.select()}
            className="field min-h-48 resize-none p-3 font-mono text-[13px] font-medium"
          />
          <div className="sheet__actions">
            <Button
              variant="ghost"
              onClick={() => setSheet(null)}
              className="min-h-13.5 text-[17px]"
            >
              {t('common.close')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void copy()}
              className="min-h-13.5 text-[17px]"
            >
              <Icon name={copied ? 'check' : 'copy'} />
              {copied ? t('teamBuilder.menu.copied') : t('teamBuilder.menu.copy')}
            </Button>
          </div>
        </Sheet>
      )}
      {sheet === 'discard' && (
        <Sheet title={t('myTeams.discardTitle')} onClose={() => setSheet(null)}>
          <p className="text-[15px] leading-normal text-ink-2">{t('myTeams.discardBody')}</p>
          <div className="sheet__actions">
            <Button
              variant="ghost"
              onClick={() => setSheet(null)}
              className="min-h-13.5 text-[17px]"
            >
              {t('myTeams.keepEditing')}
            </Button>
            <Button variant="primary" onClick={() => onExit()} className="min-h-13.5 text-[17px]">
              {t('myTeams.discard')}
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
