/** Battle formats available in v1. Triples are a future extension (docs/04-battle-modes.md). */
export const GAME_TYPES = ['singles', 'doubles'] as const;
export type GameType = (typeof GAME_TYPES)[number];

export const TEAM_IDS = ['red', 'blue'] as const;
export type TeamId = (typeof TEAM_IDS)[number];

export const ROOM_PHASES = ['LOBBY', 'TEAM_BUILDING', 'BATTLE', 'RESULTS'] as const;
export type RoomPhase = (typeof ROOM_PHASES)[number];

/** Locales the UI can be switched to. Add 'es-ES' when Phase 4 lands (docs/06-i18n.md). */
export const SUPPORTED_LOCALES = ['en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Room codes: 4 letters, no ambiguous characters (I, O). 24^4 ≈ 331k combinations. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

/** v1 caps: doubles 2v2 is the largest composition. */
export const MAX_PLAYERS_PER_TEAM = 2;
export const MAX_PLAYERS_PER_ROOM = MAX_PLAYERS_PER_TEAM * TEAM_IDS.length;

/** Min/max players per team for each format. */
export const TEAM_SIZE_LIMITS: Record<GameType, { min: number; max: number }> = {
  singles: { min: 1, max: 1 },
  doubles: { min: 1, max: 2 },
};

/** Max Pokémon a team brings, split across its players (docs/04-battle-modes.md). */
export const POKEMON_PER_TEAM = 6;

/** Champions Stat Points (docs/05-game-rules-and-mechanics.md): per Pokémon and per stat. */
export const STAT_POINTS_TOTAL = 66;
export const STAT_POINTS_MAX = 32;
/** Every Poke-Air battle is at level 50 (Champions rule). */
export const BATTLE_LEVEL = 50;
/** Longest Showdown team text accepted by `team:import`. */
export const TEAM_TEXT_MAX_LENGTH = 10_000;
/** Teams a phone keeps in its saved-teams list. */
export const SAVED_TEAMS_MAX = 30;

/** Simulator sides. One side per team: red → p1, blue → p2 (docs/04-battle-modes.md). */
export const SIDE_IDS = ['p1', 'p2'] as const;
export type SideId = (typeof SIDE_IDS)[number];
export const TEAM_SIDE: Record<TeamId, SideId> = { red: 'p1', blue: 'p2' };
export const SIDE_TEAM: Record<SideId, TeamId> = { p1: 'red', p2: 'blue' };

/** Battle timings (docs/11-phase-1-plan.md). */
export const BATTLE_COUNTDOWN_MS = 3_000;
export const TURN_TIMER_MS = 60_000;
/** Phones get their next menu once the Host has animated the turn, or after this long anyway. */
export const ANIMATION_TIMEOUT_MS = 15_000;

export const PLAYER_NAME_MAX_LENGTH = 16;

/** A room without any connected client is deleted after this long. */
export const ROOM_IDLE_TTL_MS = 30 * 60 * 1000;

/** Socket.IO namespaces. Each role has its own typed event set. */
export const HOST_NAMESPACE = '/host';
export const PLAYER_NAMESPACE = '/player';
