import { build } from 'esbuild';
await build({ entryPoints: ['src/index.mjs'], bundle: true, platform: 'node', target: 'node24',
  format: 'esm', outfile: 'dist/index.mjs',
});
