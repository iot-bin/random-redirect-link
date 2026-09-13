import { createRequire } from 'node:module';
// esbuild's bundled CommonJS dependencies need Node's require in an ESM Lambda.
globalThis.require = createRequire(import.meta.url);
