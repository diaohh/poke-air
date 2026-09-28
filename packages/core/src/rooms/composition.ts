import {
  TEAM_IDS,
  TEAM_SIZE_LIMITS,
  type CompositionStatus,
  type GameType,
  type TeamId,
} from '@poke-air/shared';

/**
 * The Host only picks the format; the composition (1v1, 1v2, 2v2…) is derived from how players
 * split into teams (docs/01-vision-and-game-flow.md).
 */
export function evaluateComposition(
  gameType: GameType,
  teamSizes: Record<TeamId, number>,
): CompositionStatus {
  const { min, max } = TEAM_SIZE_LIMITS[gameType];
  const issues: CompositionStatus['issues'] = [];

  for (const team of TEAM_IDS) {
    const size = teamSizes[team];
    if (size < min) issues.push({ team, issue: 'TEAM_EMPTY' });
    else if (size > max) issues.push({ team, issue: 'TEAM_TOO_LARGE' });
  }

  return {
    valid: issues.length === 0,
    label: `${teamSizes.red}v${teamSizes.blue}`,
    issues,
  };
}
