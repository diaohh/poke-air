import {
  formatTeamText,
  splitTeamText,
  type PokemonSetData,
  type TeamTextBlock,
} from '@poke-air/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PokemonSprite } from '../../components/PokemonSprite';
import { Button } from '../../components/ui/Button';
import { Icon, type IconName } from '../../components/ui/Icon';
import { IconButton } from '../../components/ui/IconButton';
import { Sheet } from '../../components/ui/Sheet';
import { deleteSavedTeam, listSavedTeams, saveTeam, type SavedTeam } from '../../lib/saved-teams';
import { useControllerStore } from '../controller-store';
import { ErrorNote } from './ErrorNote';
import { KeepPicker } from './KeepPicker';

type Mode = 'menu' | 'import' | 'export' | 'save' | 'keep';

interface Props {
  sets: PokemonSetData[];
  /** Slots this player has: bigger teams ask which Pokémon to keep (D-54). */
  quota: number;
  onClose: () => void;
  /** Result line for the team list ("Imported 6 Pokémon"). */
  onNotice: (notice: string) => void;
}

/**
 * Team options (bottom sheet): import a Showdown text paste, export the team as text, save it on
 * this phone and load / delete saved teams (decision D-39). Loading goes through `team:import`.
 */
export function TeamMenu({ sets, quota, onClose, onNotice }: Props) {
  const { t } = useTranslation();
  const { importTeam, busy, error, errorParams, clearError } = useControllerStore();
  const [mode, setMode] = useState<Mode>('menu');
  const [saved, setSaved] = useState<SavedTeam[]>(listSavedTeams);
  const [text, setText] = useState('');
  const [name, setName] = useState(() =>
    t('teamBuilder.menu.defaultName', { n: saved.length + 1 }),
  );
  const [copied, setCopied] = useState(false);
  /** A pasted / saved team bigger than the quota, waiting for the player to pick. */
  const [keep, setKeep] = useState<TeamTextBlock[]>([]);
  const exported = sets.length > 0 ? formatTeamText(sets) : '';

  const go = (next: Mode) => {
    clearError();
    setMode(next);
  };

  const load = async (source: string) => {
    const blocks = splitTeamText(source);
    if (blocks.length > quota) {
      setKeep(blocks);
      go('keep');
      return;
    }
    await importText(source);
  };

  const importText = async (source: string) => {
    const result = await importTeam(source);
    if (!result) return;
    onNotice(
      result.skipped > 0
        ? t('teamBuilder.menu.importedSkipped', { count: result.count, skipped: result.skipped })
        : t('teamBuilder.menu.imported', { count: result.count }),
    );
    onClose();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exported);
      setCopied(true);
    } catch {
      // Clipboard blocked (plain http on a LAN IP): the text stays selectable in the box.
      setCopied(false);
    }
  };

  const titles: Record<Mode, string> = {
    menu: t('teamBuilder.menu.title'),
    import: t('teamBuilder.menu.import'),
    export: t('teamBuilder.menu.export'),
    save: t('teamBuilder.menu.save'),
    keep: t('teamBuilder.keep.title'),
  };

  return (
    <Sheet title={titles[mode]} onClose={onClose}>
      {mode === 'menu' && (
        <>
          <div className="grid gap-2">
            <MenuButton
              icon="upload"
              label={t('teamBuilder.menu.import')}
              onClick={() => go('import')}
            />
            <MenuButton
              icon="copy"
              label={t('teamBuilder.menu.export')}
              disabled={sets.length === 0}
              onClick={() => go('export')}
            />
            <MenuButton
              icon="save"
              label={t('teamBuilder.menu.save')}
              disabled={sets.length === 0}
              onClick={() => go('save')}
            />
          </div>
          <h3 className="field-label mt-1 text-xs">{t('teamBuilder.menu.saved')}</h3>
          {saved.length === 0 ? (
            <p className="text-sm font-semibold text-ink-2">{t('teamBuilder.menu.noSaved')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {saved.map((team) => (
                <li
                  key={team.id}
                  className="picker-row flex items-center gap-2 rounded-[18px] p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-base font-extrabold">{team.name}</strong>
                    <span className="mt-1 flex gap-0.5">
                      {team.species.map((species) => (
                        <span
                          key={species}
                          className="grid size-7 place-items-center overflow-hidden"
                        >
                          <PokemonSprite species={species} decorative fit />
                        </span>
                      ))}
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={() => void load(team.text)}
                    className="min-h-11 px-3.5 text-sm"
                  >
                    {t('teamBuilder.menu.load')}
                  </Button>
                  <IconButton
                    icon="trash"
                    danger
                    label={t('teamBuilder.menu.delete', { name: team.name })}
                    onClick={() => setSaved(deleteSavedTeam(team.id))}
                    className="size-11 text-lg"
                  />
                </li>
              ))}
            </ul>
          )}
          <ErrorNote error={error} params={errorParams} />
          <div className="sheet__actions">
            <Button variant="ghost" onClick={onClose} className="col-span-2 min-h-13.5 text-[17px]">
              {t('common.close')}
            </Button>
          </div>
        </>
      )}

      {mode === 'import' && (
        <>
          <p className="text-sm font-semibold text-ink-2">{t('teamBuilder.menu.importHint')}</p>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={10}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder={t('teamBuilder.menu.importPlaceholder')}
            className="field min-h-48 resize-none p-3 font-mono text-[13px] font-medium"
          />
          <ErrorNote error={error} params={errorParams} />
          <div className="sheet__actions">
            <Button variant="ghost" onClick={() => go('menu')} className="min-h-13.5 text-[17px]">
              {t('common.back')}
            </Button>
            <Button
              variant="primary"
              disabled={busy || !text.trim()}
              onClick={() => void load(text)}
              className="min-h-13.5 text-[17px]"
            >
              {t('teamBuilder.menu.importButton')}
            </Button>
          </div>
        </>
      )}

      {mode === 'keep' && (
        <>
          <KeepPicker
            blocks={keep}
            max={quota}
            busy={busy}
            onBack={() => go('menu')}
            onConfirm={(chosen) => void importText(chosen)}
          />
          <ErrorNote error={error} params={errorParams} />
        </>
      )}

      {mode === 'export' && (
        <>
          <textarea
            readOnly
            value={exported}
            rows={10}
            onFocus={(event) => event.target.select()}
            className="field min-h-48 resize-none p-3 font-mono text-[13px] font-medium"
          />
          <div className="sheet__actions">
            <Button variant="ghost" onClick={() => go('menu')} className="min-h-13.5 text-[17px]">
              {t('common.back')}
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
        </>
      )}

      {mode === 'save' && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="field-label text-xs">{t('teamBuilder.menu.teamName')}</span>
            <input
              value={name}
              maxLength={30}
              onChange={(event) => setName(event.target.value)}
              className="field min-h-13 px-4 text-[17px]"
            />
          </label>
          <div className="sheet__actions">
            <Button variant="ghost" onClick={() => go('menu')} className="min-h-13.5 text-[17px]">
              {t('common.back')}
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() => {
                setSaved(
                  saveTeam(
                    name.trim(),
                    exported,
                    sets.map((set) => set.species),
                  ),
                );
                go('menu');
              }}
              className="min-h-13.5 text-[17px]"
            >
              <Icon name="save" />
              {t('teamBuilder.menu.saveButton')}
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function MenuButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="picker-row flex min-h-14 items-center gap-3 rounded-[18px] px-4 text-left text-base font-extrabold"
    >
      <Icon name={icon} className="size-5 shrink-0 text-(color:--deep)" />
      {label}
    </button>
  );
}
