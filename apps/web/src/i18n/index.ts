import { DEFAULT_LOCALE, type Locale } from '@poke-air/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUi from './locales/en/ui.json';

/**
 * All user-facing text goes through i18next (docs/06-i18n.md).
 * - Namespace `ui`: our own strings. Pokémon data namespaces (names/battle/desc) arrive in Phase 4.
 * - English is bundled; other locales will be lazy-loaded when added.
 * - The active language follows the room locale (`useRoomLocale`).
 */
export const defaultNS = 'ui';

export const resources = {
  en: { ui: enUi },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS,
  ns: [defaultNS],
  interpolation: { escapeValue: false }, // React already escapes.
  returnNull: false,
});

export function applyLocale(locale: Locale): void {
  if (i18n.language !== locale) void i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
}

export default i18n;
