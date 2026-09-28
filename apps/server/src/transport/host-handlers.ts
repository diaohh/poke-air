import { RoomError, type Room } from '@poke-air/core';
import {
  emptyPayloadSchema,
  hostCreateRoomSchema,
  hostKickSchema,
  hostResumeRoomSchema,
  hostSetFormatSchema,
  hostSetLocaleSchema,
  type HostSession,
} from '@poke-air/shared';
import type { HostSocket, Realtime } from './realtime.js';
import type { z } from 'zod';
import { withValidation } from './with-validation.js';

export function registerHostHandlers(rt: Realtime): void {
  rt.hosts.on('connection', (socket: HostSocket) => {
    const log = rt.logger.child({ ns: 'host', socket: socket.id });
    const on = <S extends z.ZodType, R extends object | void>(
      schema: S,
      handler: (payload: z.output<S>) => R,
    ) => withValidation(schema, log, handler);

    /** Binds this socket as the room's Host screen, replacing any previous one. */
    const attach = (room: Room): HostSession => {
      const previous = rt.hostSocket(room.code);
      if (previous && previous.id !== socket.id) previous.disconnect();
      rt.hostSocketByRoom.set(room.code, socket.id);
      socket.data.code = room.code;
      void socket.join(room.code);
      room.setHostConnected(true);
      rt.broadcast(room);
      return { code: room.code, hostToken: room.hostToken, room: room.toPublicState() };
    };

    const currentRoom = (): Room => {
      const code = socket.data.code;
      if (!code) throw new RoomError('NOT_IN_ROOM');
      return rt.rooms.require(code);
    };

    socket.on(
      'host:createRoom',
      on(hostCreateRoomSchema, ({ locale }) => {
        const room = rt.rooms.createRoom(locale ? { locale } : {});
        log.info({ code: room.code }, 'Room created');
        return attach(room);
      }),
    );

    socket.on(
      'host:resumeRoom',
      on(hostResumeRoomSchema, ({ code, hostToken }) => {
        const room = rt.rooms.require(code);
        if (room.hostToken !== hostToken) throw new RoomError('INVALID_HOST_TOKEN');
        return attach(room);
      }),
    );

    socket.on(
      'host:setFormat',
      on(hostSetFormatSchema, ({ gameType }) => {
        const room = currentRoom();
        room.setGameType(gameType);
        rt.broadcast(room);
      }),
    );

    socket.on(
      'host:setLocale',
      on(hostSetLocaleSchema, ({ locale }) => {
        const room = currentRoom();
        room.setLocale(locale);
        rt.broadcast(room);
      }),
    );

    socket.on(
      'host:kick',
      on(hostKickSchema, ({ playerId }) => {
        const room = currentRoom();
        room.removePlayer(playerId);
        const phone = rt.playerSocket(playerId);
        rt.playerSocketById.delete(playerId);
        if (phone) {
          phone.emit('player:removed', 'kicked');
          phone.data = {};
          phone.disconnect();
        }
        rt.broadcast(room);
      }),
    );

    socket.on(
      'host:startTeamBuilding',
      on(emptyPayloadSchema, () => {
        const room = currentRoom();
        room.startTeamBuilding();
        rt.broadcast(room);
      }),
    );

    socket.on(
      'host:backToLobby',
      on(emptyPayloadSchema, () => {
        const room = currentRoom();
        room.backToLobby();
        rt.broadcast(room);
      }),
    );

    socket.on('disconnect', () => {
      const code = socket.data.code;
      if (!code || rt.hostSocketByRoom.get(code) !== socket.id) return;
      rt.hostSocketByRoom.delete(code);
      const room = rt.rooms.get(code);
      if (!room) return;
      room.setHostConnected(false);
      rt.broadcast(room);
    });
  });
}
