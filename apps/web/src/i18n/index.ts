import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@poke-air/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUi from './locales/en/ui.json';
import esUiJson from './locales/es-ES/ui.json';

/**
 * All user-facing text goes through i18next (docs/06-i18n.md, docs/15-phase-4-plan.md).
 * - Namespace `ui`: our own strings, English and Spanish (Spain), bundled (≈ 30 KB each).
 * - Pokémon names (species, moves, items, abilities, natures) come from `lib/dex-names.ts`.
 * - The active language follows the room locale (`useRoomLocale`); outside a room, the browser's.
 */
export const defaultNS = 'ui';

/** Every key of the English file must exist in Spanish (a missing one fails the typecheck). */
const esUi: typeof enUi = esUiJson;

export const resources = {
  en: { ui: enUi },
  'es-ES': { ui: esUi },
} as const;

/** The first supported language of the browser (any Spanish → es-ES), else English. */
export function browserLocale(): Locale {
  for (const language of navigator.languages ?? [navigator.language]) {
    const exact = SUPPORTED_LOCALES.find((locale) => locale === language);
    if (exact) return exact;
    const primary = language.split('-')[0];
    const match = SUPPORTED_LOCALES.find((locale) => locale.split('-')[0] === primary);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

const initial = browserLocale();
document.documentElement.lang = initial;

void i18n.use(initReactI18next).init({
  resources,
  lng: initial,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS,
  ns: [defaultNS],
  interpolation: { escapeValue: false }, // React already escapes.
  returnNull: false,
});

/** The language the UI shows now (Home's selector or the browser's). */
export function currentLocale(): Locale {
  return SUPPORTED_LOCALES.find((locale) => locale === i18n.language) ?? browserLocale();
}

export function applyLocale(locale: Locale): void {
  if (i18n.language !== locale) void i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
}

export default i18n;
