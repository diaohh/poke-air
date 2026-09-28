import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

export type PlayerStatus = 'ready' | 'building' | 'pending' | 'choosing';

interface Props {
  status: PlayerStatus;
  className?: string;
}

/**
 * Player state as icon + color + word (`✓ Ready` · `● Building` · `● Choosing` · `Pending`).
 * Size via className.
 */
export function StatusPill({ status, className }: Props) {
  const { t } = useTranslation();
  return (
    <span className={cn('status-pill', `status-pill--${status}`, className)}>
      {status === 'ready' && '✓ '}
      {t(`status.${status}`)}
    </span>
  );
}
