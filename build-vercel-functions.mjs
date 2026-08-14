import { mkdirSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

mkdirSync('api', { recursive: true });
for (const staleFile of ['api/[...path].js', 'api/index.cjs', 'api/[...path].cjs']) {
  try {
    unlinkSync(staleFile);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

await build({
  bundle: true,
  entryPoints: ['server/application.ts'],
  packages: 'external',
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  sourcemap: false,
  outfile: 'api/index.js',
  footer: {
    js: 'module.exports = module.exports.default || module.exports;',
  },
});

const require = createRequire(import.meta.url);
const handler = require('./api/index.js');
if (typeof handler !== 'function') {
  throw new Error('Vercel API bundle did not export an Express-compatible function.');
}
console.log('Verified Vercel API bundle can be loaded by Node CommonJS.');
