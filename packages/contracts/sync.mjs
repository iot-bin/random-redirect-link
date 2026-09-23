import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = await readFile(resolve(root, 'packages/contracts/index.mjs'), 'utf8');
const generated = `// Generated from packages/contracts/index.mjs. Do not edit directly.\n${source}`;
const targets = ['admin', 'api', 'control'].map((name) => resolve(root, `lambda/${name}/src/link-contracts.mjs`));
const check = process.argv.includes('--check');
for (const target of targets) {
  if (check) {
    const actual = await readFile(target, 'utf8').catch(() => null);
    if (actual !== generated) throw new Error(`Outdated generated contract: ${target}`);
  } else {
    await writeFile(target, generated);
  }
}
