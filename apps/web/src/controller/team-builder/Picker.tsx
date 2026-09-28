import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/ui/Icon';
import { searchKey } from '../../lib/team-dex';
import { NavRow } from './NavRow';

/** Rows rendered at once: enough to scroll, cheap on phones (the lists have up to 1234 entries). */
const LIMIT = 60;

export interface PickerSection<T> {
  /** Section heading (e.g. "Suggested"); omitted for the main list. */
  title?: string;
  items: T[];
}

interface Props<T> {
  title: string;
  sections: PickerSection<T>[];
  keyOf: (item: T) => string;
  /** Text the search matches against (name, types…). */
  searchText: (item: T) => string;
  render: (item: T) => ReactNode;
  onPick: (item: T) => void;
  onClose: () => void;
  isDisabled?: (item: T) => boolean;
  /** Pinned first row (e.g. "No item"), hidden while searching. */
  first?: ReactNode;
}

/** The matching rows of every section, the first `LIMIT` of them in total. */
function filterSections<T>(
  sections: PickerSection<T>[],
  needle: string,
  searchText: (item: T) => string,
): { shown: { title?: string; rows: T[] }[]; hidden: number } {
  const shown: { title?: string; rows: T[] }[] = [];
  let budget = LIMIT;
  let hidden = 0;
  for (const section of sections) {
    const matches = needle
      ? section.items.filter((item) => searchKey(searchText(item)).includes(needle))
      : section.items;
    const rows = matches.slice(0, Math.max(0, budget));
    budget -= rows.length;
    hidden += matches.length - rows.length;
    shown.push({ ...(section.title ? { title: section.title } : {}), rows });
  }
  return { shown, hidden };
}

/**
 * Full-screen searchable list over the phone (species, items, moves, natures). Shows the first
 * rows only; typing narrows the list. Tapping a row picks it.
 */
export function Picker<T>({
  title,
  sections,
  keyOf,
  searchText,
  render,
  onPick,
  onClose,
  isDisabled,
  first,
}: Props<T>) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const needle = searchKey(query.trim());

  const { shown, hidden } = useMemo(
    () => filterSections(sections, needle, searchText),
    [sections, needle, searchText],
  );

  const empty = shown.every((section) => section.rows.length === 0);

  return (
    <div className="picker fixed inset-0 z-30 mx-auto flex max-w-md flex-col gap-3 px-4.5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <NavRow title={title} onBack={onClose} />
      <label className="relative block">
        <span className="sr-only">{t('teamBuilder.picker.search')}</span>
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg text-muted">
          <Icon name="search" />
        </span>
        <input
          type="search"
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('teamBuilder.picker.search')}
          className="field min-h-13 py-3 pr-4 pl-11 text-[17px]"
        />
      </label>
      <div className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1.5 pt-1 pb-3">
        {!needle && first}
        {shown.map((section, i) =>
          section.rows.length === 0 ? null : (
            <section key={section.title ?? i} className="flex flex-col gap-2">
              {section.title && <h3 className="field-label mt-1 text-[11px]">{section.title}</h3>}
              {section.rows.map((item) => {
                const disabled = isDisabled?.(item) ?? false;
                return (
                  <button
                    key={keyOf(item)}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(item)}
                    className="picker-row flex w-full shrink-0 items-center gap-3 rounded-[18px] px-3 py-2.5 text-left"
                  >
                    {render(item)}
                  </button>
                );
              })}
            </section>
          ),
        )}
        {empty && (
          <p className="py-6 text-center text-[15px] font-semibold text-ink-2">
            {t('teamBuilder.picker.noResults')}
          </p>
        )}
        {hidden > 0 && (
          <p className="py-2 text-center text-[13px] font-semibold text-ink-2">
            {t('teamBuilder.picker.more', { count: hidden })}
          </p>
        )}
      </div>
    </div>
  );
}
