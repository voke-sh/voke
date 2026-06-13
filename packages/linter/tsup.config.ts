import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'cli/index': 'src/cli/index.ts',
  },
  format: ['esm'],
  // Bundle ajv and ajv-formats inline — they use non-standard ESM import paths
  // (ajv/dist/2020 without .js extension) that break Node.js ESM resolution at runtime.
  // Bundle @voke/core too — its exports resolve to TS source (not runnable JS), and a
  // shipped single-binary CLI must be self-contained (no runtime dep on a private workspace pkg).
  noExternal: ['ajv', 'ajv-formats', '@voke/core'],
  // Only generate type declarations for the library entry (not the CLI entry)
  dts: {
    entry: { index: 'src/index.ts' },
    resolve: true,
    compilerOptions: {
      // Disable composite project references for DTS build (tsup runs a separate tsc)
      composite: false,
      incremental: false,
    },
  },
  clean: true,
});
