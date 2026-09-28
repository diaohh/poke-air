import { useSyncExternalStore } from 'react';

/** Safari (iPadOS) still ships the prefixed API. iPhone Safari has none: fullscreen is unsupported there. */
interface PrefixedDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}
interface PrefixedElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

const doc = () => document as PrefixedDocument;

export function isFullscreenSupported(): boolean {
  return Boolean(document.fullscreenEnabled || doc().webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  return Boolean(document.fullscreenElement ?? doc().webkitFullscreenElement);
}

/** Touch-first device (phones/tablets). Desktop test windows are left alone. */
export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Enters fullscreen. Must be called synchronously inside a user gesture (click/tap) or the browser
 * rejects it. Resolves `false` instead of throwing when it is unsupported or denied.
 */
export async function enterFullscreen(): Promise<boolean> {
  if (isFullscreen()) return true;
  if (!isFullscreenSupported()) return false;
  const el = document.documentElement as PrefixedElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else await el.webkitRequestFullscreen?.();
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(): Promise<void> {
  if (!isFullscreen()) return;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else await doc().webkitExitFullscreen?.();
  } catch {
    // Already left (e.g. the user pressed Esc meanwhile).
  }
}

export function toggleFullscreen(): void {
  if (isFullscreen()) void exitFullscreen();
  else void enterFullscreen();
}

function subscribe(onChange: () => void): () => void {
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
  return () => {
    document.removeEventListener('fullscreenchange', onChange);
    document.removeEventListener('webkitfullscreenchange', onChange);
  };
}

/** Re-renders when the page enters or leaves fullscreen (Esc, back gesture, system UI…). */
export function useIsFullscreen(): boolean {
  return useSyncExternalStore(subscribe, isFullscreen, () => false);
}
