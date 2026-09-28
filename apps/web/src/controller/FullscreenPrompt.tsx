import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PokeBall } from '../components/ui/PokeBall';
import {
  enterFullscreen,
  isFullscreenSupported,
  isTouchDevice,
  useIsFullscreen,
} from '../lib/fullscreen';

/** Grace period so the prompt doesn't flash while a just-requested fullscreen is settling. */
const SHOW_DELAY_MS = 400;

/**
 * AirConsole-style guard for phones: while `active` (seated in a room) and the page is not fullscreen
 * — the back gesture exits it, a reload never starts in it — cover the screen with "Tap to continue".
 * The tap is the user gesture the browser needs to re-enter fullscreen. Skipped where fullscreen is
 * unsupported (iPhone Safari) and on non-touch devices (desktop test windows).
 */
export function FullscreenPrompt({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const fullscreen = useIsFullscreen();
  const [visible, setVisible] = useState(false);
  // If the browser refuses (permissions, policy), stop asking for this session.
  const [refused, setRefused] = useState(false);
  const wanted = active && !fullscreen && !refused && isTouchDevice() && isFullscreenSupported();

  useEffect(() => {
    if (!wanted) return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setVisible(false);
    };
  }, [wanted]);

  if (!wanted || !visible) return null;

  const resume = () => {
    void enterFullscreen().then((ok) => {
      if (!ok) setRefused(true);
    });
  };

  return (
    <button
      type="button"
      onClick={resume}
      className="phone-shell fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-8 text-center"
    >
      <PokeBall size={96} tone="team" animation="bounce" />
      <span className="font-display text-[40px] leading-tight">
        {t('controller.fullscreen.title')}
      </span>
      <span className="max-w-[280px] text-base font-semibold text-ink-2">
        {t('controller.fullscreen.hint')}
      </span>
    </button>
  );
}
