import type { EffectDuration, MoveMeta, PublicRoomState } from '@poke-air/shared';
import { useEffect, useRef } from 'react';
import { useCountdown } from '../../lib/use-countdown';
import { activePokemon } from '../battle-scene/model';
import type { PlaybackFrame } from '../battle-scene/playback';
import { hasUserActivation, music, playCry, playSfx, unlockAudio, type Track } from './engine';
import { sfxForEvent } from './sounds';

const TRACKS: Record<PublicRoomState['phase'], Track> = {
  LOBBY: 'lobby',
  TEAM_BUILDING: 'lobby',
  BATTLE: 'battle',
  RESULTS: 'victory',
};

/** Unlocks audio on the first click / key (or right away if the page already had one). */
export function useAudioUnlock(): void {
  useEffect(() => {
    if (hasUserActivation()) unlockAudio();
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
}

/** Music per phase + UI sounds for what happens in the room (joins, ready, countdown, start). */
export function useRoomAudio(room: PublicRoomState | undefined, roomAt: number): void {
  const phase = room?.phase;
  useEffect(() => {
    music.play(phase ? TRACKS[phase] : null);
  }, [phase]);
  useEffect(() => () => music.play(null), []);

  const previous = useRef<PublicRoomState | undefined>(undefined);
  useEffect(() => {
    const before = previous.current;
    previous.current = room;
    if (!before || !room || before.code !== room.code) return;
    if (room.players.length > before.players.length) playSfx('join');
    else if (room.players.length < before.players.length) playSfx('leave');
    const ready = (state: PublicRoomState) => state.players.filter((p) => p.ready).length;
    if (ready(room) > ready(before)) playSfx('ready');
    if (before.phase !== 'BATTLE' && room.phase === 'BATTLE') playSfx('go');
  }, [room]);

  const seconds = useCountdown(room?.battleCountdownMs, roomAt);
  useEffect(() => {
    if (seconds) playSfx('tick');
  }, [seconds]);
}

/** Battle effects + cries, one per animated event (never for resync / skipped lines). */
export function useBattleAudio(
  frame: PlaybackFrame,
  moves: Record<string, MoveMeta>,
  effects: Record<string, EffectDuration>,
): void {
  const { event, eventId, scene } = frame;
  const played = useRef(0);
  const previous = useRef(event);

  useEffect(() => {
    if (!event || eventId === played.current) return;
    played.current = eventId;
    const category = event.kind === 'move' && event.move ? moves[event.move]?.category : undefined;
    const sfx = sfxForEvent(event, category, previous.current, effects);
    previous.current = event;
    if (sfx) playSfx(sfx);

    if ((event.kind === 'switch' || event.kind === 'faint') && event.side) {
      const pokemon = activePokemon(scene, event.side, event.position);
      // The cry follows the Poké Ball pop; a fainting Pokémon cries lower.
      const pitch = event.kind === 'faint' ? 0.8 : 1;
      if (pokemon) setTimeout(() => playCry(pokemon.species, pitch), 280);
    }
  }, [event, eventId, moves, effects, scene]);
}
