import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { static as serveStatic } from 'express';
import { createServer as createViteServer } from 'vite';
import app from './server/app';
import { validateRuntimeConfiguration } from './server/config';

// Vite also reads local dotenv files. Load the same configuration for the
// colocated Express server, with a non-secret local callback override for dev.
loadEnv({ path: '.env.local' });
if (process.env.NODE_ENV !== 'production') {
  loadEnv({ path: '.env.development.local', override: true });
}
loadEnv();

const currentFile = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === currentFile;

export async function startServer(): Promise<void> {
  // Validate before serving any route so a missing secret or an incorrect OAuth
  // callback fails clearly instead of producing a browser-side OAuth failure.
  validateRuntimeConfiguration();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // API routes are registered on the Express app before Vite's SPA fallback.
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(serveStatic(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const configuredPort = Number(process.env.PORT ?? '3001');
  const port = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 3001;
  await new Promise<void>((resolve) => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Servidor disponible en http://0.0.0.0:${port}`);
      resolve();
    });
  });
}

if (isDirectRun && process.env.VERCEL !== '1') {
  startServer().catch((error) => {
    console.error('No se pudo iniciar el servidor local.', error);
    process.exitCode = 1;
  });
}

export default app;
