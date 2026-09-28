import { useEffect, useRef, useState } from 'react';
import type { HostBattleLog } from '../host-store';
import { initialScene } from './model';
import { BattlePlayback, type PlaybackFrame } from './playback';

/** `/host?speed=4` plays animations faster (demos, E2E). */
const SPEED = Number(new URLSearchParams(window.location.search).get('speed')) || 1;

/**
 * Drives a `BattlePlayback` from the store's log and returns the frame to render. Space / Enter /
 * → skip what is queued. `onCaughtUp` reports progress to the server (`host:animated`).
 */
export function useBattlePlayback(
  log: HostBattleLog,
  onCaughtUp: (upTo: number) => void,
): PlaybackFrame {
  const [frame, setFrame] = useState<PlaybackFrame>(() => ({
    scene: initialScene(),
    event: null,
    eventId: 0,
    messages: [],
    log: [],
  }));
  const playback = useRef<BattlePlayback | null>(null);
  const epoch = useRef(-1);

  useEffect(() => {
    const current = new BattlePlayback({ onFrame: setFrame, onCaughtUp, speed: SPEED });
    playback.current = current;
    epoch.current = -1;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowRight') {
        event.preventDefault();
        current.skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      current.destroy();
      playback.current = null;
    };
  }, [onCaughtUp]);

  useEffect(() => {
    const current = playback.current;
    if (!current) return;
    if (epoch.current !== log.epoch) {
      epoch.current = log.epoch;
      current.reset(log.lines, log.resync);
    } else {
      current.feed(log.lines);
    }
  }, [log, onCaughtUp]);

  return frame;
}
