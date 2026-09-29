import {
  dexDescriptionsUrl,
  dexNamesUrl,
  toId,
  type DexDescriptionsData,
  type DexNamesData,
} from '@poke-air/shared';
import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Localized Pokémon names and descriptions (Phase 4, docs/15-phase-4-plan.md). The server, the
 * simulator and the team text format speak English; the UI shows names and descriptions in the
 * room / page language through these localizers: `names.move('Earthquake')` → "Terremoto".
 * Tables come from `/data/names.<locale>.json` and `/data/desc.<locale>.json`
 * (`pnpm build:locales`), each loaded once per locale and only by the screens that use it;
 * anything missing (a table not generated yet, an untranslated forme or Gen 9 text) falls back to
 * English.
 */
export interface DexNamer {
  species: (name: string) => string;
  move: (name: string) => string;
  ability: (name: string) => string;
  item: (name: string) => string;
  nature: (name: string) => string;
  /** A field / side / hurt-by effect: a move ("Trampa Rocas"), an item or an ability name. */
  effect: (name: string) => string;
}

/** Localized description by English name, or the given English description. */
export interface DexDescriber {
  move: (name: string, english: string) => string;
  item: (name: string, english: string) => string;
  ability: (name: string, english: string) => string;
}

type LoadState<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'failed' };

/** One JSON file per locale, fetched once and shared by every component that asks for it. */
function createLoader<T>(url: (locale: string) => string) {
  const states = new Map<string, LoadState<T>>();
  const listeners = new Set<() => void>();
  const load = (locale: string) => {
    if (states.has(locale)) return;
    states.set(locale, { status: 'loading' });
    fetch(url(locale))
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<T>;
      })
      .then((data) => states.set(locale, { status: 'ready', data }))
      .catch(() => states.set(locale, { status: 'failed' }))
      .finally(() => {
        for (const listener of listeners) listener();
      });
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  /** The locale's data once loaded (English needs none: `null`). */
  return function useLocaleData(): T | null {
    const { i18n } = useTranslation();
    const locale = i18n.language;
    const state = useSyncExternalStore(
      subscribe,
      () => states.get(locale),
      () => states.get(locale),
    );
    useEffect(() => {
      if (locale !== 'en') load(locale);
    }, [locale]);
    return locale !== 'en' && state?.status === 'ready' ? state.data : null;
  };
}

const useNamesData = createLoader<DexNamesData>(dexNamesUrl);
const useDescriptionsData = createLoader<DexDescriptionsData>(dexDescriptionsUrl);

const english: DexNamer = {
  species: (name) => name,
  move: (name) => name,
  ability: (name) => name,
  item: (name) => name,
  nature: (name) => name,
  effect: (name) => name,
};
const englishDescriptions: DexDescriber = {
  move: (_name, text) => text,
  item: (_name, text) => text,
  ability: (_name, text) => text,
};

const namers = new WeakMap<DexNamesData, DexNamer>();
function namerFor(tables: DexNamesData): DexNamer {
  let namer = namers.get(tables);
  if (!namer) {
    const lookup = (table: Record<string, string>) => (name: string) => table[toId(name)] ?? name;
    namer = {
      species: lookup(tables.species),
      move: lookup(tables.moves),
      ability: lookup(tables.abilities),
      item: lookup(tables.items),
      nature: lookup(tables.natures),
      effect: (name) => {
        const id = toId(name);
        return tables.moves[id] ?? tables.items[id] ?? tables.abilities[id] ?? name;
      },
    };
    namers.set(tables, namer);
  }
  return namer;
}

const describers = new WeakMap<DexDescriptionsData, DexDescriber>();
function describerFor(tables: DexDescriptionsData): DexDescriber {
  let describer = describers.get(tables);
  if (!describer) {
    const lookup = (table: Record<string, string>) => (name: string, text: string) =>
      table[toId(name)] ?? text;
    describer = {
      move: lookup(tables.moves),
      item: lookup(tables.items),
      ability: lookup(tables.abilities),
    };
    describers.set(tables, describer);
  }
  return describer;
}

/** The namer for the current UI language (English names until the table arrives). */
export function useDexNames(): DexNamer {
  const data = useNamesData();
  return data ? namerFor(data) : english;
}

/**
 * Descriptions in the current UI language (the official in-game text; English until the table
 * arrives and wherever it has no text). Only the team builder and the move sheet load them.
 */
export function useDexDescriptions(): DexDescriber {
  const data = useDescriptionsData();
  return data ? describerFor(data) : englishDescriptions;
}
