import type { GameType, Locale, RoomPhase, TeamId } from './constants.js';
import type { TrainerAvatar } from './avatars.js';

/** Public view of a player. Safe to send to every client in the room. */
export interface PublicPlayer {
  id: string;
  name: string;
  avatar: TrainerAvatar;
  team: TeamId;
  connected: boolean;
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
}
