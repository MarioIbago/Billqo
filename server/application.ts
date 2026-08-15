import express, { type ErrorRequestHandler } from 'express';
import type { ApiError } from '../src/types';
import { requireFirebaseAuth } from './auth';
import baseApp from './app';
import billingRouter from './billingRoutes';
import { AppError, toApiError } from './errors';
import { hardenPreferencesInput, hardenTransactionInput } from './inputHardening';
import { limitAuthenticatedApi, limitInboundApi } from './rateLimit';
import receiptRouter from './receiptRoutes';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(['/api/receipts/scan', '/api/billing'], (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use('/api/receipts/scan', limitInboundApi, requireFirebaseAuth, limitAuthenticatedApi, receiptRouter);
app.use('/api/billing', limitInboundApi, requireFirebaseAuth, limitAuthenticatedApi, billingRouter);

const protectedFeatureErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    const body: ApiError = {
      code: 'VALIDATION_FAILED',
      message: 'El archivo es demasiado grande. Reduce su tamaño e inténtalo de nuevo.',
      recoverable: true,
    };
    res.status(413).json({ error: body });
    return;
  }

  const status = error instanceof AppError ? error.status : 500;
  const body = toApiError(error);
  if (status >= 500) {
    console.error('Protected feature request failed', {
      status,
      code: error instanceof AppError ? error.code : 'INTERNAL',
    });
  }
  res.status(status).json({ error: body });
};

app.use('/api/receipts/scan', protectedFeatureErrorHandler);
app.use('/api/billing', protectedFeatureErrorHandler);

// Parse small mutable finance payloads before the base app so malformed or
// oversized input never reaches the main financial handlers.
app.use('/api/transactions', express.json({ limit: '32kb' }), hardenTransactionInput);
app.use('/api/preferences', express.json({ limit: '8kb' }), hardenPreferencesInput);

const structuredBodyErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  const type = error && typeof error === 'object' && 'type' in error ? String(error.type) : '';
  if (type !== 'entity.too.large' && type !== 'entity.parse.failed') {
    next(error);
    return;
  }

  const body: ApiError = {
    code: 'VALIDATION_FAILED',
    message: type === 'entity.too.large'
      ? 'Los datos enviados son demasiado grandes.'
      : 'Los datos enviados no contienen JSON válido.',
    recoverable: true,
  };
  res.status(type === 'entity.too.large' ? 413 : 400).json({ error: body });
};

app.use('/api/transactions', structuredBodyErrorHandler);
app.use('/api/preferences', structuredBodyErrorHandler);
app.use(baseApp);

export default app;
