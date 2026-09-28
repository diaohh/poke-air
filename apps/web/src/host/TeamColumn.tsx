import type { PublicPlayer, TeamId } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { TrainerSprite } from '../components/TrainerSprite';

const TEAM_STYLES: Record<TeamId, string> = {
  red: 'border-team-red bg-team-red-dark/40',
  blue: 'border-team-blue bg-team-blue-dark/40',
};

interface Props {
  team: TeamId;
  players: PublicPlayer[];
  onKick: (playerId: string) => void;
}

export function TeamColumn({ team, players, onKick }: Props) {
  const { t } = useTranslation();

  return (
    <div className={`flex flex-col gap-6 rounded-3xl border-4 p-8 ${TEAM_STYLES[team]}`}>
      <h2 className="text-5xl font-black">{t(`teams.${team}`)}</h2>
      {players.length === 0 && <p className="text-3xl text-slate-400">{t('host.emptyTeam')}</p>}
      <ul className="flex flex-col gap-4">
        {players.map((player) => (
          <li
            key={player.id}
            className={`group flex items-center gap-6 rounded-2xl bg-black/30 p-4 ${
              player.connected ? '' : 'opacity-50'
            }`}
          >
            <TrainerSprite avatar={player.avatar} className="size-28" />
            <div className="flex-1">
              <p className="text-4xl font-bold">{player.name}</p>
              <p className="text-2xl text-slate-400">
                {player.connected ? t(`trainers.${player.avatar}`) : t('common.disconnected')}
              </p>
            </div>
            <button
              onClick={() => onKick(player.id)}
              className="rounded-xl bg-black/40 px-5 py-3 text-xl text-slate-300 opacity-0 transition group-hover:opacity-100"
            >
              {t('host.kick')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
