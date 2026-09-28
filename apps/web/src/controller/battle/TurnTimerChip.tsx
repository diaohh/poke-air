import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { formatSeconds, useCountdown } from '../../lib/use-countdown';
import { useControllerStore } from '../controller-store';

/** Header chip with the turn timer while someone is choosing (urgent in the last 10 s). */
export function TurnTimerChip() {
  const { t } = useTranslation();
  const waiting = useControllerStore((s) => s.waiting);
  const seconds = useCountdown(
    waiting?.waitingFor.length ? waiting.timerMs : null,
    waiting?.receivedAt ?? 0,
  );
  if (seconds === null) return null;
  return (
    <span
      role="timer"
      aria-label={t('host.battle.timer')}
      className={cn(
        'phone-timer inline-flex items-center gap-2 rounded-full px-3.5 py-2 font-black',
        seconds <= 10 && 'phone-timer--urgent',
      )}
    >
      {formatSeconds(seconds)}
    </span>
  );
}
