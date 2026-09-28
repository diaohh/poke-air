/**
 * Error codes sent to clients. Clients translate them with the i18n key `errors.<code>`;
 * the server never sends user-facing prose.
 */
export const ERROR_CODES = [
  'INVALID_PAYLOAD',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'TEAM_FULL',
  'INVALID_HOST_TOKEN',
  'INVALID_RECONNECT_TOKEN',
  'PLAYER_NOT_FOUND',
  'NOT_IN_ROOM',
  'WRONG_PHASE',
  'INVALID_COMPOSITION',
  'INVALID_SLOT',
  'INVALID_SET',
  'SPECIES_CLAUSE',
  'INVALID_IMPORT',
  'EMPTY_TEAM',
  'TEAM_TOO_SMALL',
  'PLAYERS_NOT_READY',
  'NO_ACTIVE_BATTLE',
  'NO_PENDING_REQUEST',
  'STALE_REQUEST',
  'ALREADY_CHOSEN',
  'INVALID_CHOICE',
  'CANT_UNDO',
  'RATE_LIMITED',
  'TOO_MANY_ROOMS',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorPayload {
  code: ErrorCode;
  params?: Record<string, string | number>;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: ErrorPayload };
