import {
  HOST_NAMESPACE,
  PLAYER_NAMESPACE,
  type HostClientToServerEvents,
  type HostServerToClientEvents,
  type PlayerClientToServerEvents,
  type PlayerServerToClientEvents,
} from '@poke-air/shared';
import { io, type Socket } from 'socket.io-client';
import { backendUrl } from './backend';

export type HostSocket = Socket<HostServerToClientEvents, HostClientToServerEvents>;
export type PlayerSocket = Socket<PlayerServerToClientEvents, PlayerClientToServerEvents>;

const options = {
  autoConnect: false,
  // Keep retrying forever: the free backend can take ~1 min to wake up, phones lock screens.
  reconnection: true,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 5_000,
};

export function createHostSocket(): HostSocket {
  return io(`${backendUrl()}${HOST_NAMESPACE}`, options);
}

export function createPlayerSocket(): PlayerSocket {
  return io(`${backendUrl()}${PLAYER_NAMESPACE}`, options);
}
