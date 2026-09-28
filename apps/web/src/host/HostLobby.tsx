import {
  GAME_TYPES,
  TEAM_SIZE_LIMITS,
  type GameType,
  type PublicRoomState,
  type TeamId,
} from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { PokeBall } from '../components/ui/PokeBall';
import { cn } from '../lib/cn';
import { useHostStore } from './host-store';
import { JoinPanel } from './JoinPanel';
import { TeamPanel } from './TeamPanel';

/** Host lobby: format picker, both teams with a VS burst, composition status, Start, join panel. */
export function HostLobby({ room }: { room: PublicRoomState }) {
  const { t } = useTranslation();
  const setFormat = useHostStore((s) => s.setFormat);
  const kick = useHostStore((s) => s.kick);
  const startTeamBuilding = useHostStore((s) => s.startTeamBuilding);
  const { max } = TEAM_SIZE_LIMITS[room.gameType];

  const panel = (team: TeamId) => {
    const players = room.players.filter((p) => p.team === team);
    return (
      <TeamPanel
        team={team}
        players={players}
        count={t('host.teamCount', { count: players.length, max })}
        openSlots={Math.max(0, max - players.length)}
        onKick={(id) => void kick(id)}
      />
    );
  };

  return (
    <div className="grid min-h-0 grid-cols-[1fr_580px] gap-9 px-11 pt-2 pb-11">
      <main className="grid min-h-0 grid-rows-[auto_1fr_auto] gap-7">
        <div className="flex items-end justify-between gap-7.5">
          <div>
            <h1 className="font-display text-[60px] leading-none">{t('host.lobby.title')}</h1>
            <p className="mt-2 text-2xl text-ink-2">{t('host.lobby.hint')}</p>
          </div>
          <FormatPicker value={room.gameType} onChange={(gameType) => void setFormat(gameType)} />
        </div>

        <div className="grid min-h-0 grid-cols-[1fr_120px_1fr]">
          {panel('red')}
          <div className="grid place-items-center">
            <span className="vs-burst size-[150px] text-[62px]">{t('host.lobby.vs')}</span>
          </div>
          {panel('blue')}
        </div>

        <div className="grid grid-cols-[1fr_auto] items-stretch gap-6">
          <CompositionCard room={room} />
          <Button
            variant="primary"
            xl
            glow
            disabled={!room.composition.valid}
            onClick={() => void startTeamBuilding()}
            className="min-w-[470px] rounded-lg px-11 font-display text-[44px] font-normal"
          >
            {t('host.startGame')}
            <Icon name="arrowRight" />
          </Button>
        </div>
      </main>

      <JoinPanel room={room} />
    </div>
  );
}

function FormatPicker({
  value,
  onChange,
}: {
  value: GameType;
  onChange: (gameType: GameType) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="radiogroup"
      aria-label={t('host.lobby.format')}
      className="flex gap-1.5 rounded-3xl bg-paper p-1.75 shadow-lift"
    >
      {GAME_TYPES.map((gameType) => {
        const selected = gameType === value;
        return (
          <button
            key={gameType}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(gameType)}
            className={cn(
              'flex h-18 items-center gap-3 rounded-md px-7.5 text-[28px] font-extrabold transition-colors',
              selected
                ? 'bg-wine text-paper shadow-[0_5px_0_var(--color-wine-deep)]'
                : 'text-muted hover:text-ink-2',
            )}
          >
            <span className="flex gap-1">
              {Array.from({ length: TEAM_SIZE_LIMITS[gameType].max }, (_, i) => (
                <PokeBall key={i} size={20} tone={selected ? 'gold' : 'muted'} />
              ))}
            </span>
            {t(`formats.${gameType}`)}
          </button>
        );
      })}
    </div>
  );
}

function CompositionCard({ room }: { room: PublicRoomState }) {
  const { t } = useTranslation();
  const error = useHostStore((s) => s.error);
  const format = t(`formats.${room.gameType}`);
  const { max } = TEAM_SIZE_LIMITS[room.gameType];
  const { valid, label, issues } = room.composition;
  const waiting = room.players.length === 0;

  const [title, hint] = waiting
    ? [t('host.composition.waiting'), t('host.composition.waitingHint')]
    : valid
      ? [t('host.composition.valid', { label, format }), t('host.composition.validHint')]
      : [
          issues
            .map(({ team, issue }) =>
              t(`host.composition.${issue}`, { team: t(`teams.${team}`), format, max }),
            )
            .join(' · '),
          issues[0] && t(`host.composition.hint.${issues[0].issue}`),
        ];

  return (
    <div
      role="status"
      className="flex min-h-[120px] items-center gap-5.5 rounded-lg bg-paper px-7.5 py-4 text-3xl font-bold shadow-lift"
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-16 shrink-0 place-items-center rounded-full text-[34px] font-black',
          valid ? 'bg-ok-soft text-ok-deep' : 'bg-warn-soft text-warn-deep',
        )}
      >
        {valid ? '✓' : '!'}
      </span>
      <div className="min-w-0">
        <p>{title}</p>
        {error ? (
          <p className="mt-1 text-[22px] font-semibold text-warn-deep">{t(`errors.${error}`)}</p>
        ) : (
          hint && <p className="mt-1 text-[22px] font-medium text-ink-2">{hint}</p>
        )}
      </div>
    </div>
  );
}
