import { SUPPORTED_LOCALES, type Locale } from '@poke-air/shared';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { Icon } from './ui/Icon';

interface Props {
  value: Locale;
  onChange: (locale: Locale) => void;
  /** Pill size/typography utilities. */
  className?: string;
  /** Menu font size (its spacing is in `em`, so it scales with it). */
  menuClassName?: string;
}

/**
 * Language pill: globe + current language, opening our own listbox (a native `<select>` shows the
 * operating system's list, e.g. Windows' blue highlight). Keyboard: ↑ ↓ to move, Enter / Space to
 * pick, Esc or Tab to close; a click outside closes it too. Language names are shown in their own
 * language, so anyone can find theirs.
 */
export function LanguageSelect({ value, onChange, className, menuClassName }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => SUPPORTED_LOCALES.indexOf(value));
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const show = () => {
    setActive(Math.max(0, SUPPORTED_LOCALES.indexOf(value)));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const pick = (locale: Locale) => {
    if (locale !== value) onChange(locale);
    close();
  };

  const onButtonKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      show();
    }
  };
  const onListKey = (event: KeyboardEvent) => {
    const last = SUPPORTED_LOCALES.length - 1;
    if (event.key === 'ArrowDown') setActive((i) => Math.min(last, i + 1));
    else if (event.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1));
    else if (event.key === 'Home') setActive(0);
    else if (event.key === 'End') setActive(last);
    else if (event.key === 'Enter' || event.key === ' ') {
      const locale = SUPPORTED_LOCALES[active];
      if (locale) pick(locale);
    } else if (event.key === 'Escape') close();
    else if (event.key === 'Tab') close(false);
    else return;
    event.preventDefault();
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${t('common.language')}: ${t(`locales.${value}`)}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={onButtonKey}
        className={cn(
          'flex cursor-pointer items-center bg-paper font-bold text-ink-2 shadow-lift transition-colors hover:text-ink',
          className,
        )}
      >
        <Icon name="globe" />
        <span>{t(`locales.${value}`)}</span>
        <span
          aria-hidden="true"
          className={cn('text-[0.7em] transition-transform', open && 'rotate-180')}
        >
          ▾
        </span>
      </button>

      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={t('common.language')}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
          className={cn(
            'absolute top-[calc(100%+0.5em)] right-0 z-50 flex min-w-full flex-col gap-[0.2em] rounded-[0.9em] bg-paper p-[0.35em] shadow-float outline-none',
            menuClassName,
          )}
        >
          {SUPPORTED_LOCALES.map((locale, index) => {
            const selected = locale === value;
            return (
              <li
                key={locale}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                onPointerEnter={() => setActive(index)}
                onClick={() => pick(locale)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-[1.2em] rounded-[0.6em] px-[0.8em] py-[0.5em] font-bold whitespace-nowrap text-ink-2',
                  index === active && 'bg-wine-tint text-wine',
                  selected && 'font-extrabold text-wine',
                )}
              >
                {t(`locales.${locale}`)}
                <Icon name="check" className={cn('size-[1em]', !selected && 'invisible')} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
