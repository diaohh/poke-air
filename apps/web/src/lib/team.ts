import type { TeamId } from '@poke-air/shared';

/** Class that sets the team palette (`--c`, `--deep`, `--soft`, `--tint`) for its subtree. */
export const TEAM_SCOPE: Record<TeamId | 'neutral', string> = {
  red: 'team-scope--red',
  blue: 'team-scope--blue',
  neutral: 'team-scope--neutral',
};
