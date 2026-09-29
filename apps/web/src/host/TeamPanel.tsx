import type { PublicPlayer, TeamId } from '@poke-air/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PokeBall } from '../components/ui/PokeBall';
import { TeamChip } from '../components/ui/TeamChip';
import { cn } from '../lib/cn';
import { TEAM_SCOPE } from '../lib/team';
import { PlayerCard } from './PlayerCard';

interface Props {
  team: TeamId;
  players: PublicPlayer[];
  /** Right side of the panel header (e.g. "1 / 2 trainers"). */
  count: string;
  /** Dashed empty seats to show after the players (lobby). */
  openSlots?: number;
  /** Per-player status line (team building). */
  renderStatus?: (player: PublicPlayer) => ReactNode;
  onKick?: (playerId: string) => void;
  className?: string;
}

/** Host team panel: striped team-tinted card with a team badge and its player cards. */
export function TeamPanel({
  team,
  players,
  count,
  openSlots = 0,
  renderStatus,
  onKick,
  className,
}: Props) {
  const { t } = useTranslation();

  return (
    <section
      className={cn('team-panel flex min-h-0 flex-col gap-5 p-6.5', TEAM_SCOPE[team], className)}
    >
      <div className="flex items-center justify-between">
        <TeamChip team={team} large ballSize={34} className="text-4xl" />
        <span className="text-[26px] font-extrabold whitespace-nowrap text-(color:--deep)">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-4.5">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            status={renderStatus?.(player)}
            onKick={onKick && (() => onKick(player.id))}
          />
        ))}
        {Array.from({ length: openSlots }, (_, i) => (
          <div
            key={`open-${i}`}
            className="open-slot flex h-[196px] items-center justify-center gap-5 rounded-lg text-[28px] font-bold"
          >
            <PokeBall size={52} tone="outline" />
            {t('host.openSlot')}
          </div>
        ))}
      </div>
    </section>
  );
}
