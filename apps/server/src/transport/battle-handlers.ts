import type { Room } from '@poke-air/core';
import { battleChooseSchema, emptyPayloadSchema, hostAnimatedSchema } from '@poke-air/shared';
import type { HostSocket, PlayerSocket, Realtime } from './realtime.js';
import type { On } from './with-validation.js';

/**
 * Battle events. The rules (animation sync, timer, choices) live in core's `MatchController`;
 * here we only validate, call it and let its listener emit (see `Realtime.match`).
 */

export function registerHostBattleHandlers(
  rt: Realtime,
  socket: HostSocket,
  on: On,
  currentRoom: () => Room,
): void {
  socket.on(
    'host:animated',
    on(hostAnimatedSchema, ({ upTo }) => {
      rt.match(currentRoom()).hostAnimated(upTo);
    }),
  );

  socket.on(
    'host:rematch',
    on(emptyPayloadSchema, () => {
      const room = currentRoom();
      room.rematch();
      rt.match(room).sync();
      rt.broadcast(room);
      rt.sendTeamStates(room);
    }),
  );
}

/** A (re)attached Host rebuilds the scene from the whole log, without animating it. */
export function resyncHost(rt: Realtime, socket: HostSocket, room: Room): void {
  const match = rt.match(room);
  const log = match.resyncLog();
  if (!log) return;
  socket.emit('battle:log', log);
  socket.emit('battle:waiting', match.waiting());
}

export function registerPlayerBattleHandlers(
  rt: Realtime,
  socket: PlayerSocket,
  on: On,
  currentSeat: () => { room: Room; playerId: string },
): void {
  socket.on(
    'battle:choose',
    on(battleChooseSchema, ({ choice, rqid }) => {
      const { room, playerId } = currentSeat();
      rt.match(room).choose(playerId, choice, rqid);
    }),
  );

  socket.on(
    'battle:undo',
    on(emptyPayloadSchema, () => {
      const { room, playerId } = currentSeat();
      rt.match(room).undo(playerId);
    }),
  );

  socket.on(
    'battle:forfeit',
    on(emptyPayloadSchema, () => {
      const { room, playerId } = currentSeat();
      rt.match(room).forfeit(playerId);
    }),
  );
}

/** A (re)joining phone gets its current menu and the waiting state. */
export function resyncPlayer(rt: Realtime, socket: PlayerSocket, room: Room, playerId: string) {
  const match = rt.match(room);
  if (!match.inBattle) return;
  socket.emit('battle:request', match.requestFor(playerId));
  socket.emit('battle:waiting', match.waiting());
}
