import {
  MAX_PLAYERS_PER_TEAM,
  TEAM_IDS,
  TEAM_SIZE_LIMITS,
  type PublicPlayer,
  type PublicRoomState,
  type TeamId,
} from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { TrainerSprite } from '../components/TrainerSprite';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { PokeBall } from '../components/ui/PokeBall';
import { TeamChip } from '../components/ui/TeamChip';
import { cn } from '../lib/cn';
import { TEAM_SCOPE } from '../lib/team';
import { useControllerStore } from './controller-store';

interface Props {
  room: PublicRoomState;
  me: PublicPlayer;
}

/** Lobby on the phone: Red card above Blue card, each with its players and a join button. */
export function ControllerLobby({ room, me }: Props) {
  const { t } = useTranslation();
  const { switchTeam, leave, error } = useControllerStore();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      <h1 className="font-display text-[30px] leading-tight">{t('controller.chooseTeam')}</h1>

      <div className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-1.5 pt-1 pb-2.5">
        {TEAM_IDS.map((team) => (
          <TeamCard
            key={team}
            team={team}
            room={room}
            me={me}
            onJoin={() => void switchTeam(team)}
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="text-center text-sm font-semibold text-warn-deep">
          {t(`errors.${error}`)}
        </p>
      )}

      <p
        role="status"
        className="flex items-center justify-center gap-3 text-[15px] font-bold text-ink-2"
      >
        <PokeBall size={26} tone="team" animation="bounce" />
        {room.hostConnected ? t('controller.waitingForHost') : t('controller.hostOffline')}
      </p>

      <Button
        variant="ghost"
        onClick={() => void leave()}
        className="min-h-13 w-full rounded-md text-base"
      >
        <Icon name="exit" />
        {t('controller.leave')}
      </Button>
    </div>
  );
}

interface TeamCardProps {
  team: TeamId;
  room: PublicRoomState;
  me: PublicPlayer;
  onJoin: () => void;
}

function TeamCard({ team, room, me, onJoin }: TeamCardProps) {
  const { t } = useTranslation();
  const players = room.players.filter((p) => p.team === team);
  const { max } = TEAM_SIZE_LIMITS[room.gameType];
  const openSlots = Math.max(0, max - players.length);
  const mine = me.team === team;
  const full = players.length >= MAX_PLAYERS_PER_TEAM;

  return (
    <section className={cn('team-card rounded-[22px] p-3.5', TEAM_SCOPE[team])}>
      <div className="mb-2.5 flex items-center justify-between">
        <TeamChip team={team} className="text-sm" />
        <span className="text-sm font-extrabold text-(color:--deep)">
          {t('controller.teamSlots', { count: players.length, max })}
        </span>
      </div>

      <ul className="mb-3 flex flex-col gap-1.5">
        {players.map((p) => (
          <li
            key={p.id}
            className={cn(
              'team-card__row flex items-center gap-2.5 rounded-[14px] py-1.5 pr-2.5 pl-1.5 text-base font-bold',
              !p.connected && 'opacity-60',
            )}
          >
            <TrainerSprite
              avatar={p.avatar}
              decorative
              className={cn('size-10', !p.connected && 'grayscale')}
            />
            <span className="truncate">{p.name}</span>
            {p.id === me.id ? (
              <span className="ml-auto text-[11px] font-black tracking-widest text-(color:--deep) uppercase">
                {t('common.you')}
              </span>
            ) : (
              !p.connected && (
                <span className="ml-auto text-[11px] font-black tracking-widest text-muted uppercase">
                  {t('common.disconnected')}
                </span>
              )
            )}
          </li>
        ))}
        {Array.from({ length: openSlots }, (_, i) => (
          <li
            key={`open-${i}`}
            className="team-card__slot flex min-h-12 items-center justify-center rounded-[14px] text-sm font-semibold italic"
          >
            {t('controller.openSlot')}
          </li>
        ))}
      </ul>

      {mine ? (
        <p className="flex min-h-13 items-center justify-center gap-2 rounded-md bg-(color:--tint) font-extrabold text-(color:--deep)">
          <Icon name="check" />
          {t('controller.onThisTeam')}
        </p>
      ) : (
        <Button
          variant={team === 'red' ? 'team-red' : 'team-blue'}
          disabled={full}
          onClick={onJoin}
          className="min-h-13 w-full rounded-md text-[17px]"
        >
          {t('controller.joinTeam', { team: t(`teams.${team}`) })}
        </Button>
      )}
    </section>
  );
}
