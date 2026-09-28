import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/ui/Icon';

interface Props {
  title: string;
  onBack?: () => void;
  /** Extra controls on the right (icon buttons). */
  children?: ReactNode;
}

/** Back button + display title (team editor, pickers). */
export function NavRow({ title, onBack, children }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5">
      {onBack && (
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={onBack}
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-paper text-[22px] shadow-lift"
        >
          <Icon name="back" />
        </button>
      )}
      <h2 className="min-w-0 flex-1 truncate font-display text-2xl leading-tight">{title}</h2>
      {children}
    </div>
  );
}
