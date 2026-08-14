import { mkdirSync, readFileSync, unlinkSync } from 'node:fs';
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
  // Bundle package dependencies by default so ESM-only transitive packages such
  // as jose are transformed together with their CommonJS callers. Keep only
  // stable Node-oriented packages external to avoid needlessly inflating the
  // function bundle.
  packages: 'bundle',
  external: ['express', 'googleapis', 'google-auth-library'],
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  sourcemap: false,
  outfile: 'api/index.js',
  footer: {
    js: 'module.exports = module.exports.default || module.exports;',
  },
});

const generatedBundle = readFileSync('api/index.js', 'utf8');
for (const forbiddenRuntimeRequire of ['require("jose")', "require('jose')", 'require("jwks-rsa")', "require('jwks-rsa')"]) {
  if (generatedBundle.includes(forbiddenRuntimeRequire)) {
    throw new Error(`Vercel API bundle still contains an unsafe runtime dependency: ${forbiddenRuntimeRequire}`);
  }
}

const require = createRequire(import.meta.url);
const handler = require('./api/index.js');
if (typeof handler !== 'function') {
  throw new Error('Vercel API bundle did not export an Express-compatible function.');
}
console.log('Verified Vercel API bundle can be loaded by Node CommonJS without jose/jwks-rsa runtime requires.');
