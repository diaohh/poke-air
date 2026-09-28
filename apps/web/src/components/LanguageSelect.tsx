import { SUPPORTED_LOCALES, type Locale } from '@poke-air/shared';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { Icon } from './ui/Icon';

interface Props {
  value: Locale;
  onChange: (locale: Locale) => void;
  /** Pill size/typography utilities. */
  className?: string;
}

/** Language pill: globe icon + native select styled as a paper chip. */
export function LanguageSelect({ value, onChange, className }: Props) {
  const { t } = useTranslation();
  return (
    <label
      className={cn(
        'relative flex cursor-pointer items-center bg-paper font-bold text-ink-2 shadow-lift',
        className,
      )}
    >
      <Icon name="globe" />
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Locale)}
        className="cursor-pointer appearance-none bg-transparent pr-[1.2em] outline-none"
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {t(`locales.${locale}`)}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-[0.9em]">
        ▾
      </span>
    </label>
  );
}
