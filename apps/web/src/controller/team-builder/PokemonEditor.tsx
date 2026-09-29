import {
  BATTLE_LEVEL,
  STAT_POINTS_TOTAL,
  toId,
  type ErrorCode,
  type ErrorPayload,
  type DexItem,
  type DexMove,
  type DexNature,
  type DexSpecies,
  type PokemonSetData,
} from '@poke-air/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemIcon } from '../../components/ItemIcon';
import { PokemonSprite } from '../../components/PokemonSprite';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { IconButton } from '../../components/ui/IconButton';
import { PokeBall } from '../../components/ui/PokeBall';
import { cn } from '../../lib/cn';
import { isLightType, typeStyle } from '../../lib/pokemon-types';
import { EMPTY_POINTS, totalPoints } from '../../lib/stats';
import { learnsetOf, useTeamDex, type TeamDex } from '../../lib/team-dex';
import { TypeChip } from '../battle/sheets';
import { ErrorNote } from './ErrorNote';
import { NaturePicker } from './NaturePicker';
import { NavRow } from './NavRow';
import { Picker } from './Picker';
import { StatPointsEditor } from './StatPointsEditor';

/**
 * What the editor needs from its container (the room's team builder or the standalone `/teams`
 * page): both validate on the server, through the room or the stateless `builder:*` events.
 */
export interface EditorActions {
  /** Validates and stores the set; `true` when accepted (the editor then closes). */
  onSave: (set: PokemonSetData) => Promise<boolean>;
  /** Removes the Pokémon being edited (existing ones only). */
  onRemove?: () => Promise<unknown>;
  /** A new set for this species (moves, ability, item, nature, SP), `null` on error (D-52). */
  onRandomSet: (species: string) => Promise<PokemonSetData | null>;
  busy: boolean;
  error: ErrorCode | 'CONNECTION' | undefined;
  errorParams: ErrorPayload['params'];
  clearError: () => void;
}

interface Props extends EditorActions {
  /** The Pokémon in the slot, `null` for a new one. */
  initial: PokemonSetData | null;
  /**
   * Species in the player's other slots (Species Clause hint). The server also checks the
   * teammates' Pokémon, which are private to them.
   */
  otherSpecies: string[];
  onDone: () => void;
}

/**
 * Per-Pokémon editor (Phase 2, docs/12-design-system.md § Team builder): species, item, ability,
 * nature, up to 4 moves and Stat Points, with the Lv 50 stats live. The server validates on Save.
 */
export function PokemonEditor(props: Props) {
  const { t } = useTranslation();
  const state = useTeamDex();

  if (state.status === 'ready') return <EditorForm dex={state.dex} {...props} />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <NavRow title={t('teamBuilder.editor.title')} onBack={props.onDone} />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 text-center">
        {state.status === 'loading' ? (
          <>
            <PokeBall size={72} tone="brand" animation="spin" />
            <p className="text-base font-semibold text-ink-2">{t('teamBuilder.editor.loading')}</p>
          </>
        ) : (
          <p className="text-base font-semibold text-warn-deep">
            {t('teamBuilder.editor.dataMissing')}
          </p>
        )}
      </div>
    </div>
  );
}

type PickerKind = 'species' | 'item' | 'nature' | { move: number };

function newSet(species: DexSpecies): PokemonSetData {
  return {
    name: species.name,
    species: species.name,
    item: species.requiredItems?.[0] ?? '',
    ability: species.abilities[0] ?? '',
    moves: [],
    nature: 'Hardy',
    evs: { ...EMPTY_POINTS },
    level: BATTLE_LEVEL,
  };
}

function EditorForm({
  dex,
  initial,
  otherSpecies,
  onDone,
  onSave,
  onRemove,
  onRandomSet,
  busy,
  error,
  errorParams,
  clearError,
}: Props & { dex: TeamDex }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<PokemonSetData | null>(initial);
  // A new Pokémon (or one whose species the data doesn't know) starts at the species list.
  const [picker, setPicker] = useState<PickerKind | null>(
    initial && dex.speciesById.has(toId(initial.species)) ? null : 'species',
  );
  const [localError, setLocalError] = useState<'noMoves' | null>(null);

  const species = draft ? dex.speciesById.get(toId(draft.species)) : undefined;
  const nature = draft?.nature ? dex.natureById.get(toId(draft.nature)) : undefined;
  const learnset = useMemo(() => (species ? learnsetOf(dex, species) : []), [dex, species]);
  const takenBaseSpecies = useMemo(
    () =>
      new Set(
        otherSpecies.map((name) => toId(dex.speciesById.get(toId(name))?.baseSpecies ?? name)),
      ),
    [dex, otherSpecies],
  );

  const update = (changes: Partial<PokemonSetData>) => {
    setLocalError(null);
    clearError();
    setDraft((current) => (current ? { ...current, ...changes } : current));
  };

  const pickSpecies = (next: DexSpecies) => {
    setPicker(null);
    clearError();
    if (!draft) {
      setDraft(newSet(next));
      return;
    }
    // Keep what still fits the new species: learnable moves, a valid ability, the item.
    const legal = new Set(learnsetOf(dex, next).map((move) => move.name));
    setDraft({
      ...draft,
      name: next.name,
      species: next.name,
      ability: next.abilities.includes(draft.ability) ? draft.ability : (next.abilities[0] ?? ''),
      item: next.requiredItems?.[0] ?? draft.item,
      moves: draft.moves.filter((move) => legal.has(move)),
    });
  };

  const setMove = (index: number, move: DexMove | null) => {
    if (!draft) return;
    const moves = [...draft.moves];
    if (move) moves[index] = move.name;
    else moves.splice(index, 1);
    update({ moves: moves.filter((m, i) => m && moves.indexOf(m) === i).slice(0, 4) });
  };

  const save = async () => {
    if (!draft) return;
    if (draft.moves.length === 0) {
      setLocalError('noMoves');
      return;
    }
    if (await onSave(draft)) onDone();
  };

  /** 🎲: a new set for the same species; the draft is only stored on Save (decision D-52). */
  const randomizeSet = async () => {
    if (!draft) return;
    const set = await onRandomSet(draft.species);
    if (!set) return;
    setLocalError(null);
    // Keep the current item when the generated set has none.
    setDraft({ ...set, item: set.item || draft.item });
  };

  const closePicker = () => {
    // Closing the species list of a brand-new Pokémon cancels the edit.
    if (!draft || !species) onDone();
    setPicker(null);
  };

  if (picker !== null) {
    return (
      <PickerFor
        kind={picker}
        dex={dex}
        draft={draft}
        species={species}
        learnset={learnset}
        takenBaseSpecies={takenBaseSpecies}
        onClose={closePicker}
        onSpecies={pickSpecies}
        onItem={(item) => {
          update({ item: item?.name ?? '' });
          setPicker(null);
        }}
        onNature={(picked) => {
          update({ nature: picked.name });
          setPicker(null);
        }}
        onMove={(index, move) => {
          setMove(index, move);
          setPicker(null);
        }}
      />
    );
  }
  if (!draft || !species) return null;

  const moveRows = Array.from({ length: 4 }, (_, i) => draft.moves[i]);
  const abilityDesc = dex.data.abilities[draft.ability];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <NavRow
        title={initial ? t('teamBuilder.editor.title') : t('teamBuilder.editor.newTitle')}
        onBack={onDone}
      >
        <IconButton
          icon="dice"
          label={t('teamBuilder.editor.random')}
          disabled={busy}
          onClick={() => void randomizeSet()}
          className="size-12 text-xl"
        />
      </NavRow>

      <div className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1.5 pt-1 pb-2">
        <button
          type="button"
          onClick={() => setPicker('species')}
          className="phone-card flex shrink-0 items-center gap-3 rounded-[22px] p-3 text-left"
        >
          <div className="grid size-18 shrink-0 place-items-center overflow-hidden rounded-2xl bg-(color:--tint)">
            <PokemonSprite species={species.name} decorative fit />
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-xl font-extrabold">{species.name}</strong>
            <span className="mt-1 flex flex-wrap gap-1">
              {species.types.map((type) => (
                <TypeChip key={type} type={type} className="px-2.5 py-1 text-[11px]" />
              ))}
            </span>
          </div>
          <span className="flex items-center gap-1 text-sm font-extrabold text-(color:--deep)">
            {t('teamBuilder.editor.change')}
            <Icon name="edit" />
          </span>
        </button>

        <Field label={t('teamBuilder.editor.item')} onClick={() => setPicker('item')}>
          <span className="flex min-w-0 items-center gap-2">
            {draft.item && <ItemIcon icon={dex.itemById.get(toId(draft.item))?.icon} />}
            <span className={cn('truncate', !draft.item && 'text-muted')}>
              {draft.item || t('teamBuilder.editor.noItem')}
            </span>
          </span>
        </Field>
        {species.megaStones && !species.megaStones.includes(draft.item) && (
          <p className="-mt-1.5 px-1 text-[13px] font-semibold text-ink-2">
            {t('teamBuilder.editor.megaHint', { item: species.megaStones.join(' / ') })}
          </p>
        )}
        {species.megaMove && (
          <p className="-mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-[13px] font-semibold text-ink-2">
            {draft.moves.includes(species.megaMove) ? (
              <>
                <span className="tag tag--mega text-[10px]">{t('battle.megaTag')}</span>
                {t('teamBuilder.editor.megaMoveReady', { move: species.megaMove })}
              </>
            ) : (
              t('teamBuilder.editor.megaMoveHint', { move: species.megaMove })
            )}
          </p>
        )}

        <section className="phone-card flex shrink-0 flex-col gap-2 rounded-[22px] p-3.5">
          <h3 className="field-label text-xs">{t('teamBuilder.editor.ability')}</h3>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {species.abilities.map((ability) => (
              <button
                key={ability}
                type="button"
                role="radio"
                aria-checked={draft.ability === ability}
                onClick={() => update({ ability })}
                className={cn(
                  'choice-chip rounded-full px-3.5 py-2 text-sm font-extrabold',
                  draft.ability === ability && 'choice-chip--on',
                )}
              >
                {draft.ability === ability && <Icon name="check" />}
                {ability}
              </button>
            ))}
          </div>
          {abilityDesc && <p className="text-[13px] leading-snug text-ink-2">{abilityDesc}</p>}
        </section>

        <Field label={t('teamBuilder.editor.nature')} onClick={() => setPicker('nature')}>
          <span className="truncate">{nature ? <NatureText nature={nature} /> : '—'}</span>
        </Field>

        <section className="phone-card flex shrink-0 flex-col gap-2 rounded-[22px] p-3.5">
          <h3 className="field-label text-xs">{t('teamBuilder.editor.moves')}</h3>
          {moveRows.map((name, index) => {
            const move = name ? dex.moveById.get(toId(name)) : undefined;
            // Empty rows beyond the first one are only offered once the previous row is filled.
            if (!name && index > draft.moves.length) return null;
            return move ? (
              <div key={move.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPicker({ move: index })}
                  style={typeStyle(move.type)}
                  className={cn(
                    'type-chip min-h-12 flex-1 justify-between rounded-xl px-3.5 py-2 text-[15px] tracking-normal normal-case',
                    isLightType(move.type) && 'type-chip--light',
                  )}
                >
                  <span className="truncate">{move.name}</span>
                  <small className="shrink-0 text-[11px] opacity-80">
                    {t(`battle.categories.${move.category}`)}
                    {move.basePower ? ` · ${move.basePower}` : ''}
                  </small>
                </button>
                <IconButton
                  icon="x"
                  danger
                  label={t('teamBuilder.editor.clearMove', { move: move.name })}
                  onClick={() => setMove(index, null)}
                  className="size-11 text-lg"
                />
              </div>
            ) : (
              <button
                key={`empty-${index}`}
                type="button"
                onClick={() => setPicker({ move: index })}
                className="slot-empty flex min-h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-extrabold"
              >
                <Icon name="plus" />
                {t('teamBuilder.editor.addMove')}
              </button>
            );
          })}
        </section>

        <StatPointsEditor
          species={species}
          points={draft.evs}
          nature={nature}
          onChange={(evs) => update({ evs })}
        />
      </div>

      {localError && (
        <p role="alert" className="text-center text-sm font-semibold text-warn-deep">
          {t(`teamBuilder.editor.errors.${localError}`)}
        </p>
      )}
      <ErrorNote error={error} params={errorParams} />

      <div className="grid grid-cols-[auto_1fr] gap-3">
        {initial && onRemove && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void onRemove().then(onDone)}
            className="min-h-15 px-4.5 text-base"
          >
            <Icon name="trash" />
            <span className="sr-only">{t('teamBuilder.editor.remove')}</span>
          </Button>
        )}
        <Button
          variant="primary"
          disabled={busy || totalPoints(draft.evs) > STAT_POINTS_TOTAL}
          onClick={() => void save()}
          className={cn('min-h-15 text-[19px]', !(initial && onRemove) && 'col-span-2')}
        >
          <Icon name="check" />
          {t('teamBuilder.editor.save')}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="phone-card flex min-h-14 shrink-0 items-center gap-3 rounded-[22px] px-3.5 py-2.5 text-left"
    >
      <span className="field-label w-20 shrink-0 text-xs">{label}</span>
      <span className="flex min-w-0 flex-1 text-base font-extrabold">{children}</span>
      <Icon name="edit" className="size-[1em] shrink-0 text-muted" />
    </button>
  );
}

function NatureText({ nature }: { nature: DexNature }) {
  const { t } = useTranslation();
  if (!nature.plus || !nature.minus) {
    return <>{t('battle.natureNeutral', { nature: nature.name })}</>;
  }
  return (
    <>
      {nature.name}{' '}
      <span className="ml-1.5 font-bold text-ok-deep">▲ {t(`statsShort.${nature.plus}`)}</span>
      <span className="ml-1.5 font-bold text-team-red-deep">
        ▼ {t(`statsShort.${nature.minus}`)}
      </span>
    </>
  );
}

interface PickerForProps {
  kind: PickerKind;
  dex: TeamDex;
  draft: PokemonSetData | null;
  species: DexSpecies | undefined;
  learnset: DexMove[];
  takenBaseSpecies: ReadonlySet<string>;
  onClose: () => void;
  onSpecies: (species: DexSpecies) => void;
  onItem: (item: DexItem | null) => void;
  onNature: (nature: DexNature) => void;
  onMove: (index: number, move: DexMove) => void;
}

function PickerFor(props: PickerForProps) {
  const { t } = useTranslation();
  const { kind, dex, draft, species, learnset, takenBaseSpecies, onClose } = props;

  if (kind === 'species') {
    const current = species ? toId(species.baseSpecies) : '';
    return (
      <Picker
        title={t('teamBuilder.picker.species')}
        sections={[{ items: dex.species }]}
        keyOf={(s) => s.id}
        searchText={(s) => `${s.name} ${s.types.join(' ')}`}
        isDisabled={(s) =>
          toId(s.baseSpecies) !== current && takenBaseSpecies.has(toId(s.baseSpecies))
        }
        onPick={props.onSpecies}
        onClose={onClose}
        render={(s) => {
          const taken =
            toId(s.baseSpecies) !== current && takenBaseSpecies.has(toId(s.baseSpecies));
          return (
            <>
              <span className="grid size-11 shrink-0 place-items-center overflow-hidden">
                <PokemonSprite species={s.name} decorative fit />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-base font-extrabold">{s.name}</strong>
                <span className="mt-0.5 flex gap-1">
                  {s.types.map((type) => (
                    <TypeChip key={type} type={type} className="px-2 py-0.5 text-[10px]" />
                  ))}
                </span>
              </span>
              {taken ? (
                <span className="tag text-[10px]">{t('teamBuilder.picker.inTeam')}</span>
              ) : (
                <small className="shrink-0 text-xs font-bold text-muted tabular-nums">
                  {t('teamBuilder.picker.bst', {
                    total: Object.values(s.baseStats).reduce((a, b) => a + b, 0),
                  })}
                </small>
              )}
            </>
          );
        }}
      />
    );
  }

  if (kind === 'item') {
    const suggested = [...(species?.requiredItems ?? []), ...(species?.megaStones ?? [])]
      .map((name) => dex.itemById.get(toId(name)))
      .filter((item): item is DexItem => !!item);
    return (
      <Picker
        title={t('teamBuilder.picker.item')}
        sections={[
          ...(suggested.length > 0
            ? [{ title: t('teamBuilder.picker.suggested'), items: suggested }]
            : []),
          { title: t('teamBuilder.picker.allItems'), items: dex.items },
        ]}
        keyOf={(item) => item.id}
        searchText={(item) => item.name}
        onPick={props.onItem}
        onClose={onClose}
        first={
          <button
            type="button"
            onClick={() => props.onItem(null)}
            className="picker-row flex w-full shrink-0 items-center gap-3 rounded-[18px] px-3 py-3 text-left text-base font-extrabold"
          >
            <Icon name="x" />
            {t('teamBuilder.editor.noItem')}
          </button>
        }
        render={(item) => (
          <>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-(color:--tint)">
              <ItemIcon icon={item.icon} scale={1.5} />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="flex items-center gap-2 text-base font-extrabold">
                {item.name}
                {draft?.item === item.name && <Icon name="check" />}
              </strong>
              <small className="line-clamp-2 text-xs text-ink-2">{item.desc}</small>
            </span>
          </>
        )}
      />
    );
  }

  if (kind === 'nature') {
    if (!draft || !species) return null;
    return (
      <NaturePicker
        natures={dex.natures}
        current={draft.nature ? dex.natureById.get(toId(draft.nature)) : undefined}
        species={species}
        points={draft.evs}
        onPick={props.onNature}
        onClose={onClose}
      />
    );
  }

  const index = kind.move;
  const chosen = new Set(draft?.moves.filter((_, i) => i !== index) ?? []);
  return (
    <Picker
      title={t('teamBuilder.picker.move')}
      sections={[{ items: learnset }]}
      keyOf={(move) => move.id}
      searchText={(move) => `${move.name} ${move.type} ${move.category}`}
      isDisabled={(move) => chosen.has(move.name)}
      onPick={(move) => props.onMove(index, move)}
      onClose={onClose}
      render={(move) => (
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <TypeChip type={move.type} className="px-2 py-0.5 text-[10px]" />
            <strong className="min-w-0 flex-1 truncate text-base font-extrabold">
              {move.name}
            </strong>
            <small className="shrink-0 text-xs font-bold text-ink-2 tabular-nums">
              {t(`battle.categories.${move.category}`)}
              {move.basePower ? ` · ${move.basePower}` : ''}
              {typeof move.accuracy === 'number' ? ` · ${move.accuracy}%` : ''}
            </small>
          </span>
          <small className="mt-0.5 line-clamp-2 block text-xs text-ink-2">{move.desc}</small>
        </span>
      )}
    />
  );
}
