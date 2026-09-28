import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

interface Props {
  code: string;
  className?: string;
}

/** Room code on a paper chip (display font, wide tracking, wine text). */
export function CodeChip({ code, className }: Props) {
  const { t } = useTranslation();
  return (
    <span
      aria-label={t('common.roomCode', { code })}
      className={cn(
        'rounded-sm bg-paper px-3 py-1.5 font-display text-lg tracking-[0.18em] text-wine shadow-lift',
        className,
      )}
    >
      {code}
    </span>
  );
}
