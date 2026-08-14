import { mkdirSync, unlinkSync } from 'node:fs';
import { build } from 'esbuild';

mkdirSync('api', { recursive: true });
for (const staleFile of ['api/index.js', 'api/[...path].js', 'api/index.cjs', 'api/[...path].cjs']) {
  try { unlinkSync(staleFile); } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
await build({
  bundle: true,
  entryPoints: ['server/app.ts'],
  external: ['express', 'googleapis', 'google-auth-library', 'zod'],
  format: 'cjs',
  platform: 'node',
  sourcemap: false,
  outfile: 'api/index.js',
});
