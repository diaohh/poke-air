import { TEAM_IDS, type PublicRoomState, type TeamId } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { TrainerSprite } from '../components/TrainerSprite';
import { useControllerStore } from './controller-store';

const TEAM_BG: Record<TeamId, string> = {
  red: 'bg-team-red-dark/60 border-team-red',
  blue: 'bg-team-blue-dark/60 border-team-blue',
};

export function ControllerLobby({ room }: { room: PublicRoomState }) {
  const { t } = useTranslation();
  const { playerId, switchTeam, leave, error } = useControllerStore();
  const me = room.players.find((p) => p.id === playerId);
  if (!me) return null;
  const otherTeam: TeamId = me.team === 'red' ? 'blue' : 'red';

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className={`flex items-center gap-4 rounded-2xl border-2 p-4 ${TEAM_BG[me.team]}`}>
        <TrainerSprite avatar={me.avatar} className="size-20" />
        <div>
          <p className="text-xl font-bold">{me.name}</p>
          <p className="text-sm text-slate-300">
            {t('controller.yourTeam', { team: t(`teams.${me.team}`) })}
          </p>
        </div>
        <span className="ml-auto font-mono text-lg text-slate-400">{room.code}</span>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {TEAM_IDS.map((team) => (
          <div key={team} className={`rounded-xl border p-3 ${TEAM_BG[team]}`}>
            <p className="mb-2 text-sm font-bold">{t(`teams.${team}`)}</p>
            <ul className="flex flex-col gap-2">
              {room.players
                .filter((p) => p.team === team)
                .map((p) => (
                  <li
                    key={p.id}
                    className={`flex items-center gap-2 ${p.connected ? '' : 'opacity-50'}`}
                  >
                    <TrainerSprite avatar={p.avatar} className="size-8" />
                    <span className="truncate text-sm">
                      {p.name}
                      {p.id === me.id && ` (${t('common.you')})`}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <button
        onClick={() => void switchTeam(otherTeam)}
        className="rounded-xl bg-surface-raised px-4 py-4 font-bold"
      >
        {t('controller.switchTo', { team: t(`teams.${otherTeam}`) })}
      </button>

      {error && <p className="text-center text-red-400">{t(`errors.${error}`)}</p>}

      <p className="mt-auto text-center text-slate-400">
        {room.hostConnected ? t('controller.waitingForHost') : t('controller.hostOffline')}
      </p>
      <button onClick={() => void leave()} className="text-sm text-slate-500 underline">
        {t('controller.leave')}
      </button>
    </div>
  );
}
