import type { PublicPlayer, PublicRoomState, TeamId } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { PokeBall } from '../components/ui/PokeBall';
import { StatusPill, type PlayerStatus } from '../components/ui/StatusPill';
import { useCountdown } from '../lib/use-countdown';
import { useHostStore } from './host-store';
import { TeamPanel } from './TeamPanel';

function statusOf(player: PublicPlayer): PlayerStatus {
  if (player.ready) return 'ready';
  return player.connected ? 'building' : 'pending';
}

/**
 * Host during TEAM_BUILDING: red panel · brand ball + ready count · blue panel. Teams stay secret:
 * only "N / quota Pokémon" and the ready state are shown. When everyone is ready the server runs a
 * 3 s countdown (decision D-21) and the battle starts by itself.
 */
export function HostTeamBuilding({ room }: { room: PublicRoomState }) {
  const { t } = useTranslation();
  const backToLobby = useHostStore((s) => s.backToLobby);
  const error = useHostStore((s) => s.error);
  const roomAt = useHostStore((s) => s.roomAt);
  const seconds = useCountdown(room.battleCountdownMs, roomAt);
  const ready = room.players.filter((p) => p.ready).length;
  const total = room.players.length;
  const everyoneReady = total > 0 && ready === total;

  const panel = (team: TeamId) => {
    const players = room.players.filter((p) => p.team === team);
    const teamReady = players.filter((p) => p.ready).length;
    return (
      <TeamPanel
        team={team}
        players={players}
        count={t('host.teamBuilding.readyCount', { ready: teamReady, total: players.length })}
        renderStatus={(player) => (
          <span className="flex flex-wrap items-center gap-3">
            <StatusPill status={statusOf(player)} className="text-[22px]" />
            <span className="text-[22px] font-bold text-ink-2">
              {t('host.teamBuilding.pokemonCount', {
                count: player.teamCount,
                quota: player.quota,
              })}
            </span>
          </span>
        )}
      />
    );
  };

  return (
    <div className="grid min-h-0 grid-rows-[auto_1fr_auto] gap-7.5 px-15 pb-13">
      <div className="text-center">
        <h1 className="font-display text-[76px] leading-none">{t('host.teamBuilding.title')}</h1>
        <p className="mt-2.5 text-[28px] text-ink-2">{t('host.teamBuilding.subtitle')}</p>
      </div>

      <div className="grid min-h-0 grid-cols-[1fr_420px_1fr] gap-9">
        {panel('red')}
        <div className="flex flex-col items-center justify-center gap-9">
          {seconds !== null ? (
            <div role="timer" className="flex flex-col items-center gap-4 text-center">
              <p className="text-[30px] font-extrabold text-ink-2">
                {t('host.teamBuilding.countdown')}
              </p>
              <span key={seconds} className="countdown-number text-[220px]">
                {Math.max(1, seconds)}
              </span>
            </div>
          ) : (
            <>
              <div className="grid place-items-center">
                <PokeBall size={230} tone="brand" animation={everyoneReady ? 'wobble' : 'spin'} />
                <span className="loader-shadow mt-2.5 h-6 w-[170px]" />
              </div>
              <div className="text-center">
                <p className="font-display text-[52px] text-wine">
                  {t('host.teamBuilding.readyCount', { ready, total })}
                </p>
                <p className="text-2xl font-semibold text-ink-2">
                  {everyoneReady ? t('host.teamBuilding.allReady') : t('host.teamBuilding.waiting')}
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  {room.players.map((player) => (
                    <PokeBall key={player.id} size={40} tone={player.ready ? 'ok' : 'empty'} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        {panel('blue')}
      </div>

      <div className="flex items-center justify-center gap-7">
        {error && (
          <p className="text-[22px] font-semibold text-warn-deep">{t(`errors.${error}`)}</p>
        )}
        <Button
          variant="ghost"
          onClick={() => void backToLobby()}
          className="min-h-24 min-w-[300px] rounded-lg text-[32px]"
        >
          {t('host.teamBuilding.cancel')}
        </Button>
      </div>
    </div>
  );
}
