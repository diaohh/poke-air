import type { Locale } from '@poke-air/shared';
import { useEffect } from 'react';
import { applyLocale } from '../i18n';

/** The room locale (chosen by the Host) drives the UI language on every device in the room. */
export function useRoomLocale(locale: Locale | undefined): void {
  useEffect(() => {
    if (locale) applyLocale(locale);
  }, [locale]);
}
