import { TEAM_IDS, type PublicRoomState, type TeamId } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { TrainerSprite } from '../components/TrainerSprite';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { PokeBall } from '../components/ui/PokeBall';
import { TeamChip } from '../components/ui/TeamChip';
import { cn } from '../lib/cn';
import { TEAM_SCOPE } from '../lib/team';
import { useHostStore } from './host-store';

/** Host RESULTS (WP7): winner banner with its trainers, per-team KOs, Rematch / Back to lobby. */
export function HostResults({ room }: { room: PublicRoomState }) {
  const { t } = useTranslation();
  const rematch = useHostStore((s) => s.rematch);
  const backToLobby = useHostStore((s) => s.backToLobby);
  const result = room.result;
  if (!result) return null;

  const winner = result.winner;
  const loser: TeamId | null = winner ? (winner === 'red' ? 'blue' : 'red') : null;
  const reason =
    result.reason === 'forfeit' && loser
      ? t('results.reason.forfeit', { team: t(`teams.${loser}`) })
      : t(`results.reason.${result.reason}`, { turns: result.turns });

  return (
    <div
      className={cn(
        'grid min-h-0 grid-rows-[auto_1fr_auto] gap-8 px-15 pb-13',
        TEAM_SCOPE[winner ?? 'neutral'],
      )}
    >
      <div className="text-center">
        <h1 className="results-banner text-[110px]">
          {winner ? t('results.wins', { team: t(`teams.${winner}`) }) : t('results.draw')}
        </h1>
        <p className="mt-3 text-[30px] font-semibold text-ink-2">{reason}</p>
      </div>

      <div className="grid min-h-0 grid-cols-2 gap-10">
        {TEAM_IDS.map((team) => {
          const summary = result.teams[team];
          const players = room.players.filter((p) => p.team === team);
          const won = team === winner;
          return (
            <section
              key={team}
              className={cn(
                'team-panel flex flex-col items-center justify-center gap-6 p-8',
                TEAM_SCOPE[team],
                winner && !won && 'opacity-70 grayscale-[.4]',
              )}
            >
              <TeamChip team={team} large ballSize={34} className="text-4xl" />
              <div className="flex gap-6">
                {players.map((player) => (
                  <div key={player.id} className="platform flex size-[230px] flex-col items-center">
                    <TrainerSprite avatar={player.avatar} decorative className="size-[210px]" />
                  </div>
                ))}
              </div>
              <p className="text-[40px] font-extrabold">{players.map((p) => p.name).join(' & ')}</p>
              <div className="flex items-center gap-10 text-[28px] font-bold text-ink-2">
                <span>
                  <b className="font-display text-[56px] text-(color:--deep)">{summary.kos}</b>{' '}
                  {t('results.kos')}
                </span>
                <span className="flex items-center gap-3">
                  {Array.from({ length: summary.total }, (_, i) => (
                    <PokeBall key={i} size={34} tone={i < summary.remaining ? 'team' : 'muted'} />
                  ))}
                  <span className="ml-2">{t('results.remaining')}</span>
                </span>
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-7">
        <Button
          variant="ghost"
          onClick={() => void backToLobby()}
          className="min-h-24 min-w-[300px] rounded-lg text-[32px]"
        >
          {t('host.results.backToLobby')}
        </Button>
        <Button
          variant="primary"
          xl
          glow
          onClick={() => void rematch()}
          className="min-h-24 min-w-[420px] rounded-lg font-display text-[44px] font-normal"
        >
          <Icon name="refresh" />
          {t('host.results.rematch')}
        </Button>
      </div>
    </div>
  );
}
