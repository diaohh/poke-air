import { defineConfig } from 'vitest/config';

// One Vitest run for the whole monorepo. Tests live next to the code as `*.test.ts(x)`
// (`packages/data` has no `src`: its generators live in `scripts`).
export default defineConfig({
  test: {
    include: ['{apps,packages}/*/src/**/*.test.{ts,tsx}', 'packages/data/scripts/**/*.test.ts'],
    environment: 'node',
  },
});
