import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Workspace packages export TypeScript sources, so they must be bundled into the server.
  noExternal: [/^@poke-air\//],
  // The simulator stays a runtime dependency: it is CommonJS with dynamic requires (data, mods)
  // that esbuild can't bundle. `core/battle/showdown.ts` handles the ESM ↔ CJS interop.
  external: ['pokemon-showdown'],
});
