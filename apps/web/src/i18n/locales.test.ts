import { describe, expect, it } from 'vitest';
import en from './locales/en/ui.json';
import es from './locales/es-ES/ui.json';

/** Every leaf of a locale file as `path → text`. */
function leaves(node: unknown, path = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof node === 'string') return out.set(path, node);
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    for (const [leaf, text] of leaves(value, path ? `${path}.${key}` : key)) out.set(leaf, text);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/{{\s*(\w+)/g)].map((m) => m[1]).sort();

describe('UI locales', () => {
  const english = leaves(en);
  const spanish = leaves(es);

  it('has exactly the same keys in es-ES as in en', () => {
    expect([...spanish.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it('uses the same interpolation params in every translation, and no empty strings', () => {
    for (const [key, text] of english) {
      const translated = spanish.get(key) ?? '';
      expect(translated.trim(), key).not.toBe('');
      expect(placeholders(translated), key).toEqual(placeholders(text));
    }
  });
});
