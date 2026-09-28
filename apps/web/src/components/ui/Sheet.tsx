import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Phone bottom sheet: slides up over a plum 45% backdrop; tapping the backdrop or Escape closes
 * it (docs/12-design-system.md § Components). Put the actions row (`sheet__actions`) last.
 */
export function Sheet({ title, onClose, children }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 mx-auto max-w-md">
      <button
        type="button"
        aria-label={t('common.close')}
        className="sheet-backdrop absolute inset-0"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet absolute inset-x-0 bottom-0 flex max-h-[84%] flex-col gap-3.5 overflow-y-auto px-5 pt-3 pb-[max(1.4rem,env(safe-area-inset-bottom))]"
      >
        <span aria-hidden="true" className="sheet__grab mx-auto mb-0.5 h-1.25 w-11 rounded-full" />
        <h2 className="font-display text-[28px] leading-tight">{title}</h2>
        {children}
      </section>
    </div>
  );
}
