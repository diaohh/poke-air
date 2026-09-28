/**
 * Safe wrappers around Web Storage: private browsing or blocked storage must never break the game.
 * Keys are namespaced with `poke-air:`.
 */
function read<T>(storage: () => Storage, key: string): T | undefined {
  try {
    const raw = storage().getItem(`poke-air:${key}`);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(storage: () => Storage, key: string, value: unknown): void {
  try {
    if (value === undefined) storage().removeItem(`poke-air:${key}`);
    else storage().setItem(`poke-air:${key}`, JSON.stringify(value));
  } catch {
    // Ignore: persistence is a convenience.
  }
}

export const local = {
  get: <T>(key: string) => read<T>(() => window.localStorage, key),
  set: (key: string, value: unknown) => write(() => window.localStorage, key, value),
};

export const session = {
  get: <T>(key: string) => read<T>(() => window.sessionStorage, key),
  set: (key: string, value: unknown) => write(() => window.sessionStorage, key, value),
};
