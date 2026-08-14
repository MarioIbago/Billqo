import { mkdirSync, unlinkSync } from 'node:fs';
import { build } from 'esbuild';

mkdirSync('api', { recursive: true });
for (const staleFile of ['api/index.js', 'api/[...path].js', 'api/[...path].cjs']) {
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
  outfile: 'api/index.cjs',
  footer: {
    js: 'module.exports = module.exports.default || module.exports;',
  },
});
