import type { GameType, Locale, RoomPhase, TeamId } from './constants.js';
import type { TrainerAvatar } from './avatars.js';
import type { BattleResult } from './battle.js';

/** Public view of a player. Safe to send to every client in the room. */
export interface PublicPlayer {
  id: string;
  name: string;
  avatar: TrainerAvatar;
  team: TeamId;
  connected: boolean;
  /** Team building: the player marked their team as ready. */
  ready: boolean;
  /** Pokémon in the player's team (count only: species stay private until the battle). */
  teamCount: number;
  /** Max Pokémon this player brings (6 alone on a team, 3 with a teammate). */
  quota: number;
}

export type CompositionIssue = 'TEAM_EMPTY' | 'TEAM_TOO_LARGE';

export interface CompositionStatus {
  valid: boolean;
  /** e.g. "1v2". Red count first. */
  label: string;
  issues: { team: TeamId; issue: CompositionIssue }[];
}

/**
 * Room snapshot broadcast on every change (`room:state`).
 * Lobby data is public; private battle data never goes here.
 */
export interface PublicRoomState {
  code: string;
  phase: RoomPhase;
  gameType: GameType;
  locale: Locale;
  hostConnected: boolean;
  players: PublicPlayer[];
  composition: CompositionStatus;
  /** Remaining time (ms) of the "battle starts in…" countdown when sent, else `null`. */
  battleCountdownMs: number | null;
  /** Last battle result (RESULTS phase), else `null`. */
  result: BattleResult | null;
}
