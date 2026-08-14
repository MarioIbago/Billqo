import express, { type ErrorRequestHandler } from 'express';
import type { ApiError } from '../src/types';
import { requireFirebaseAuth } from './auth';
import baseApp from './app';
import { AppError, toApiError } from './errors';
import { limitAuthenticatedApi, limitInboundApi } from './rateLimit';
import receiptRouter from './receiptRoutes';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use('/api/receipts/scan', (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use('/api/receipts/scan', limitInboundApi, requireFirebaseAuth, limitAuthenticatedApi, receiptRouter);

const receiptErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    const body: ApiError = {
      code: 'VALIDATION_FAILED',
      message: 'La imagen es demasiado grande. Reduce su tamaño e inténtalo de nuevo.',
      recoverable: true,
    };
    res.status(413).json({ error: body });
    return;
  }

  const status = error instanceof AppError ? error.status : 500;
  const body = toApiError(error);
  if (status >= 500) {
    console.error('Receipt scan request failed', {
      status,
      code: error instanceof AppError ? error.code : 'INTERNAL',
    });
  }
  res.status(status).json({ error: body });
};

app.use('/api/receipts/scan', receiptErrorHandler);
app.use(baseApp);

export default app;
