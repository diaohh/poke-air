import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { PokeBall } from './PokeBall';

interface Props {
  /** Brand ball diameter in px. */
  ballSize: number;
  /** Font size / gap utilities. */
  className?: string;
}

/** Brand ball + app name in the display font. */
export function Logo({ ballSize, className }: Props) {
  const { t } = useTranslation();
  return (
    <span className={cn('flex items-center font-display text-ink', className)}>
      <PokeBall size={ballSize} tone="brand" />
      {t('app.name')}
    </span>
  );
}
