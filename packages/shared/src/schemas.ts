import { z } from 'zod';
import { TRAINER_AVATARS } from './avatars.js';
import {
  GAME_TYPES,
  PLAYER_NAME_MAX_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SUPPORTED_LOCALES,
  TEAM_IDS,
} from './constants.js';

/** Zod schemas for every client → server payload. The server validates all input with these. */

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH)
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`));

export const playerNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(PLAYER_NAME_MAX_LENGTH)
  // Letters, numbers, spaces and a few symbols. Names are shown on a TV.
  .regex(/^[\p{L}\p{N} _.'-]+$/u);

export const avatarSchema = z.enum(TRAINER_AVATARS);
export const teamIdSchema = z.enum(TEAM_IDS);
export const gameTypeSchema = z.enum(GAME_TYPES);
export const localeSchema = z.enum(SUPPORTED_LOCALES);
export const emptyPayloadSchema = z.object({}).strict();

// ── Host → Server ──────────────────────────────────────────────────
export const hostCreateRoomSchema = z.object({
  locale: localeSchema.optional(),
});
export const hostResumeRoomSchema = z.object({
  code: roomCodeSchema,
  hostToken: z.string().min(1),
});
export const hostSetFormatSchema = z.object({ gameType: gameTypeSchema });
export const hostSetLocaleSchema = z.object({ locale: localeSchema });
export const hostKickSchema = z.object({ playerId: z.string().min(1) });

// ── Player → Server ────────────────────────────────────────────────
export const playerJoinSchema = z.object({
  code: roomCodeSchema,
  name: playerNameSchema,
  avatar: avatarSchema,
  /** Present when the phone rejoins a seat it already had. */
  playerId: z.string().min(1).optional(),
  reconnectToken: z.string().min(1).optional(),
});
export const playerUpdateSchema = z.object({
  name: playerNameSchema.optional(),
  avatar: avatarSchema.optional(),
});
export const playerSwitchTeamSchema = z.object({ team: teamIdSchema });

export type EmptyPayload = z.infer<typeof emptyPayloadSchema>;
export type HostCreateRoomPayload = z.input<typeof hostCreateRoomSchema>;
export type HostResumeRoomPayload = z.input<typeof hostResumeRoomSchema>;
export type HostSetFormatPayload = z.input<typeof hostSetFormatSchema>;
export type HostSetLocalePayload = z.input<typeof hostSetLocaleSchema>;
export type HostKickPayload = z.input<typeof hostKickSchema>;
export type PlayerJoinPayload = z.input<typeof playerJoinSchema>;
export type PlayerUpdatePayload = z.input<typeof playerUpdateSchema>;
export type PlayerSwitchTeamPayload = z.input<typeof playerSwitchTeamSchema>;
