import type { TeamId } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { TEAM_SCOPE } from '../../lib/team';
import { PokeBall } from './PokeBall';

interface Props {
  team: TeamId;
  /** Host badge (display font) instead of the phone chip. */
  large?: boolean;
  /** Ball diameter in px. */
  ballSize?: number;
  className?: string;
}

/** Team color + white Poké Ball + team name. Font size via className. */
export function TeamChip({ team, large, ballSize = 20, className }: Props) {
  const { t } = useTranslation();
  return (
    <span className={cn('team-chip', large && 'team-chip--lg', TEAM_SCOPE[team], className)}>
      <PokeBall size={ballSize} tone="on-team" />
      {t(`teams.${team}`)}
    </span>
  );
}
