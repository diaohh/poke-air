import { defaultTeamService, RoomError } from '@poke-air/core';
import {
  builderParseTeamSchema,
  builderRandomSetSchema,
  builderValidateSetSchema,
} from '@poke-air/shared';
import type { PlayerSocket, Realtime } from './realtime.js';
import type { On } from './with-validation.js';

/**
 * Team builder without a room (decision D-51): stateless validation, random sets and team text
 * parsing for the phone's standalone team builder (`/teams`) and the room editor's 🎲. No seat is
 * needed and nothing is stored; each request is rate-limited per IP.
 */
export function registerBuilderHandlers(rt: Realtime, socket: PlayerSocket, on: On): void {
  const limit = () => {
    if (!rt.builderLimiter.take(rt.clientIp(socket))) throw new RoomError('RATE_LIMITED');
  };

  socket.on(
    'builder:validateSet',
    on(builderValidateSetSchema, ({ set }) => {
      limit();
      return { set: defaultTeamService().validateSet(set) };
    }),
  );

  socket.on(
    'builder:randomSet',
    on(builderRandomSetSchema, ({ species, exclude }) => {
      limit();
      const service = defaultTeamService();
      const set = species ? service.randomSetFor(species) : service.randomSets(1, exclude)[0];
      if (!set) throw new RoomError('INTERNAL_ERROR');
      return { set };
    }),
  );

  socket.on(
    'builder:parseTeam',
    on(builderParseTeamSchema, ({ text }) => {
      limit();
      return { sets: defaultTeamService().importTeam(text) };
    }),
  );
}
