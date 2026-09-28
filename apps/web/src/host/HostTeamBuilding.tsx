import type { PublicPlayer, PublicRoomState, TeamId } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { PokeBall } from '../components/ui/PokeBall';
import { StatusPill, type PlayerStatus } from '../components/ui/StatusPill';
import { useHostStore } from './host-store';
import { TeamPanel } from './TeamPanel';

/**
 * Phase 0 has no ready state yet: connected players are "Building", disconnected ones "Pending".
 * Phase 1 (WP2) replaces this with the real per-player ready flag and adds the "Battle!" button
 * (see open item O-11 in docs/08-decisions.md).
 */
function statusOf(player: PublicPlayer): PlayerStatus {
  return player.connected ? 'building' : 'pending';
}

/** Host during TEAM_BUILDING: red panel · spinning brand ball + ready count · blue panel. */
export function HostTeamBuilding({ room }: { room: PublicRoomState }) {
  const { t } = useTranslation();
  const backToLobby = useHostStore((s) => s.backToLobby);
  const error = useHostStore((s) => s.error);
  const statuses = room.players.map(statusOf);
  const ready = statuses.filter((s) => s === 'ready').length;
  const total = room.players.length;
  const everyoneReady = total > 0 && ready === total;

  const panel = (team: TeamId) => {
    const players = room.players.filter((p) => p.team === team);
    const teamReady = players.filter((p) => statusOf(p) === 'ready').length;
    return (
      <TeamPanel
        team={team}
        players={players}
        count={t('host.teamBuilding.readyCount', { ready: teamReady, total: players.length })}
        renderStatus={(player) => <StatusPill status={statusOf(player)} className="text-[22px]" />}
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
          <div className="grid place-items-center">
            <PokeBall size={230} tone="brand" animation={everyoneReady ? 'wobble' : 'spin'} />
            <span className="loader-shadow mt-2.5 h-6 w-[170px]" />
          </div>
          <div className="text-center">
            <p className="font-display text-[52px] text-wine">
              {t('host.teamBuilding.readyCount', { ready, total })}
            </p>
            <p className="text-2xl font-semibold text-ink-2">{t('host.teamBuilding.waiting')}</p>
            <div className="mt-4 flex justify-center gap-3">
              {statuses.map((status, i) => (
                <PokeBall key={i} size={40} tone={status === 'ready' ? 'ok' : 'empty'} />
              ))}
            </div>
          </div>
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
