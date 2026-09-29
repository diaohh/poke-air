import {
  POKEMON_PER_TEAM,
  splitTeamText,
  type PokemonSetData,
  type TeamTextBlock,
} from '@poke-air/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PokemonSprite } from '../components/PokemonSprite';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { IconButton } from '../components/ui/IconButton';
import { Logo } from '../components/ui/Logo';
import { Sheet } from '../components/ui/Sheet';
import { ErrorNote } from '../controller/team-builder/ErrorNote';
import { KeepPicker } from '../controller/team-builder/KeepPicker';
import { cn } from '../lib/cn';
import { deleteSavedTeam, listSavedTeams, type SavedTeam } from '../lib/saved-teams';
import { TEAM_SCOPE } from '../lib/team';
import { useTeamDex } from '../lib/team-dex';
import { TeamDraft, type Draft } from './TeamDraft';
import { useTeamsStore } from './teams-store';

/**
 * `/teams` — the phone's standalone team builder (decision D-53): build, edit, import and save
 * teams before joining any room. Saved teams are the same named Showdown texts the in-room Team
 * menu loads (D-39), so a team built here is one tap away in a battle.
 */
export function TeamsScreen() {
  const { t } = useTranslation();
  const { open, online, busy, error, errorParams, parseTeam, clearError } = useTeamsStore();
  const [saved, setSaved] = useState<SavedTeam[]>(listSavedTeams);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => open(), [open]);
  // Start loading the dex while the player looks at the list (the editor needs it).
  useTeamDex();

  const edit = async (team: SavedTeam) => {
    setNotice(null);
    const sets = await parseTeam(team.text);
    if (sets) setDraft({ id: team.id, name: team.name, sets });
  };

  if (draft) {
    return (
      <Shell>
        <TeamDraft
          draft={draft}
          onExit={(savedName) => {
            setDraft(null);
            setSaved(listSavedTeams());
            setNotice(savedName ? t('myTeams.savedNotice', { name: savedName }) : null);
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="flex min-h-10 items-center justify-between gap-2">
        <Link
          to="/"
          aria-label={t('common.back')}
          className="grid size-11 place-items-center rounded-2xl bg-paper text-xl shadow-lift"
        >
          <Icon name="back" />
        </Link>
        <Logo ballSize={26} className="gap-2 text-xl" />
      </header>

      <h1 className="font-display text-[32px] leading-tight">{t('myTeams.title')}</h1>
      <p className="-mt-2 text-sm font-semibold text-ink-2">{t('myTeams.hint')}</p>
      {!online && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md bg-warn-soft px-3.5 py-2.5 text-sm font-semibold text-warn-deep"
        >
          <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-warn" />
          {t('common.connecting')}
        </p>
      )}

      <div className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1.5 pt-1 pb-2">
        {saved.length === 0 && (
          <p className="py-8 text-center text-[15px] font-semibold text-ink-2">
            {t('myTeams.empty')}
          </p>
        )}
        {saved.map((team) => (
          <article
            key={team.id}
            className="phone-card flex shrink-0 items-center gap-2 rounded-[22px] p-3"
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => void edit(team)}
              className="min-w-0 flex-1 text-left"
            >
              <strong className="block truncate text-lg font-extrabold">{team.name}</strong>
              <span className="mt-1 flex gap-0.5">
                {team.species.map((species) => (
                  <span key={species} className="grid size-8 place-items-center overflow-hidden">
                    <PokemonSprite species={species} decorative fit />
                  </span>
                ))}
              </span>
            </button>
            <IconButton
              icon="edit"
              label={t('myTeams.edit', { name: team.name })}
              disabled={busy}
              onClick={() => void edit(team)}
              className="size-11 text-lg"
            />
            <IconButton
              icon="trash"
              danger
              label={t('teamBuilder.menu.delete', { name: team.name })}
              onClick={() => setSaved(deleteSavedTeam(team.id))}
              className="size-11 text-lg"
            />
          </article>
        ))}
      </div>

      {notice && !error && (
        <p role="status" className="text-center text-sm font-semibold text-ok-deep">
          {notice}
        </p>
      )}
      {!importing && <ErrorNote error={error} params={errorParams} />}

      <Button
        variant="ghost"
        disabled={busy}
        onClick={() => {
          clearError();
          setImporting(true);
        }}
        className="min-h-13.5 w-full text-[17px]"
      >
        <Icon name="upload" />
        {t('teamBuilder.menu.import')}
      </Button>
      <Button
        variant="primary"
        onClick={() => {
          clearError();
          setNotice(null);
          setDraft({ name: t('teamBuilder.menu.defaultName', { n: saved.length + 1 }), sets: [] });
        }}
        className="min-h-15 w-full text-[19px]"
      >
        <Icon name="plus" />
        {t('myTeams.new')}
      </Button>

      {importing && (
        <ImportSheet
          onClose={() => setImporting(false)}
          onImported={(sets) => {
            setImporting(false);
            setDraft({ name: t('teamBuilder.menu.defaultName', { n: saved.length + 1 }), sets });
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'phone-shell mx-auto flex h-dvh max-w-md flex-col gap-3.5 px-4.5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]',
        TEAM_SCOPE.neutral,
      )}
    >
      {children}
    </div>
  );
}

/** Paste Showdown text → (pick up to 6 when it has more, D-54) → a new team draft. */
function ImportSheet({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (sets: PokemonSetData[]) => void;
}) {
  const { t } = useTranslation();
  const { busy, error, errorParams, parseTeam } = useTeamsStore();
  const [text, setText] = useState('');
  const [keep, setKeep] = useState<TeamTextBlock[] | null>(null);

  const parse = async (source: string) => {
    const sets = await parseTeam(source);
    if (sets) onImported(sets.slice(0, POKEMON_PER_TEAM));
  };

  const submit = () => {
    const blocks = splitTeamText(text);
    if (blocks.length > POKEMON_PER_TEAM) setKeep(blocks);
    else void parse(text);
  };

  return (
    <Sheet
      title={keep ? t('teamBuilder.keep.title') : t('teamBuilder.menu.import')}
      onClose={onClose}
    >
      {keep ? (
        <KeepPicker
          blocks={keep}
          max={POKEMON_PER_TEAM}
          busy={busy}
          onBack={() => setKeep(null)}
          onConfirm={(chosen) => void parse(chosen)}
        />
      ) : (
        <>
          <p className="text-sm font-semibold text-ink-2">{t('myTeams.importHint')}</p>
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
          <div className="sheet__actions">
            <Button variant="ghost" onClick={onClose} className="min-h-13.5 text-[17px]">
              {t('common.close')}
            </Button>
            <Button
              variant="primary"
              disabled={busy || !text.trim()}
              onClick={submit}
              className="min-h-13.5 text-[17px]"
            >
              {t('teamBuilder.menu.importButton')}
            </Button>
          </div>
        </>
      )}
      <ErrorNote error={error} params={errorParams} />
    </Sheet>
  );
}
