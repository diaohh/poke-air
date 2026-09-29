import { RoomError, type PlayerRecord, type Room } from '@poke-air/core';
import {
  emptyPayloadSchema,
  playerJoinSchema,
  playerReadySchema,
  playerSwitchTeamSchema,
  playerUpdateSchema,
  teamImportSchema,
  teamRandomizeSchema,
  teamSetSlotSchema,
  type PlayerSession,
} from '@poke-air/shared';
import { registerPlayerBattleHandlers, resyncPlayer } from './battle-handlers.js';
import { registerBuilderHandlers } from './builder-handlers.js';
import type { PlayerSocket, Realtime } from './realtime.js';
import { withValidation, type On } from './with-validation.js';

export function registerPlayerHandlers(rt: Realtime): void {
  rt.players.on('connection', (socket: PlayerSocket) => {
    const log = rt.logger.child({ ns: 'player', socket: socket.id });
    const on: On = (schema, handler) => withValidation(schema, log, handler);

    /** Binds this socket to a seat, kicking out any older socket holding the same seat. */
    const attach = (room: Room, player: PlayerRecord): PlayerSession => {
      if (socket.data.playerId !== player.id) detach();
      const previous = rt.playerSocket(player.id);
      if (previous && previous.id !== socket.id) {
        previous.emit('player:removed', 'replaced');
        previous.data = {};
        previous.disconnect();
      }
      rt.playerSocketById.set(player.id, socket.id);
      socket.data = { code: room.code, playerId: player.id };
      void socket.join(room.code);
      room.setPlayerConnected(player.id, true);
      rt.broadcast(room);
      // Private state for this seat, sent right after the ack: own team, current battle menu.
      setImmediate(() => {
        socket.emit('team:state', room.teamState(player.id));
        resyncPlayer(rt, socket, room, player.id);
      });
      return {
        playerId: player.id,
        reconnectToken: player.reconnectToken,
        room: room.toPublicState(),
      };
    };

    /** Releases the seat this socket held (if any) without removing the player. */
    const detach = () => {
      const { code, playerId } = socket.data;
      if (!code || !playerId) return;
      if (rt.playerSocketById.get(playerId) === socket.id) {
        rt.playerSocketById.delete(playerId);
        const room = rt.rooms.get(code);
        if (room) {
          room.setPlayerConnected(playerId, false);
          rt.broadcast(room);
        }
      }
      void socket.leave(code);
      socket.data = {};
    };

    const currentSeat = (): { room: Room; playerId: string } => {
      const { code, playerId } = socket.data;
      if (!code || !playerId) throw new RoomError('NOT_IN_ROOM');
      return { room: rt.rooms.require(code), playerId };
    };

    socket.on(
      'player:join',
      on(playerJoinSchema, ({ code, name, avatar, playerId, reconnectToken }) => {
        if (!rt.joinLimiter.take(rt.clientIp(socket))) throw new RoomError('RATE_LIMITED');
        const room = rt.rooms.require(code);
        if (playerId && reconnectToken && room.getPlayer(playerId)) {
          const player = room.rejoinPlayer(playerId, reconnectToken);
          log.info({ code, playerId }, 'Player rejoined');
          return attach(room, player);
        }
        const player = room.addPlayer({ name, avatar });
        log.info({ code, playerId: player.id }, 'Player joined');
        return attach(room, player);
      }),
    );

    socket.on(
      'player:update',
      on(playerUpdateSchema, (changes) => {
        const { room, playerId } = currentSeat();
        room.updatePlayer(playerId, changes);
        rt.broadcast(room);
      }),
    );

    socket.on(
      'player:switchTeam',
      on(playerSwitchTeamSchema, ({ team }) => {
        const { room, playerId } = currentSeat();
        room.switchTeam(playerId, team);
        rt.broadcast(room);
      }),
    );

    socket.on(
      'player:leave',
      on(emptyPayloadSchema, () => {
        const { room, playerId } = currentSeat();
        room.removePlayer(playerId);
        rt.playerSocketById.delete(playerId);
        void socket.leave(room.code);
        socket.data = {};
        rt.broadcast(room);
      }),
    );

    socket.on(
      'player:ready',
      on(playerReadySchema, ({ ready }) => {
        const { room, playerId } = currentSeat();
        room.setReady(playerId, ready);
        rt.match(room).sync();
        rt.broadcast(room);
      }),
    );

    socket.on(
      'team:randomize',
      on(teamRandomizeSchema, ({ slots }) => {
        const { room, playerId } = currentSeat();
        socket.emit('team:state', room.randomizeTeam(playerId, slots));
        rt.match(room).sync();
        rt.broadcast(room);
      }),
    );

    socket.on(
      'team:setSlot',
      on(teamSetSlotSchema, ({ slot, set }) => {
        const { room, playerId } = currentSeat();
        socket.emit('team:state', room.setSlot(playerId, slot, set));
        rt.match(room).sync();
        rt.broadcast(room);
      }),
    );

    socket.on(
      'team:import',
      on(teamImportSchema, ({ text }) => {
        const { room, playerId } = currentSeat();
        const { state, count, skipped } = room.importTeam(playerId, text);
        socket.emit('team:state', state);
        rt.match(room).sync();
        rt.broadcast(room);
        return { count, skipped };
      }),
    );

    registerPlayerBattleHandlers(rt, socket, on, currentSeat);
    registerBuilderHandlers(rt, socket, on);

    socket.on('disconnect', () => detach());
  });
}
