import { createHash } from 'node:crypto';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import { calculateAnalytics, buildDeterministicInsights } from '../src/analytics';
import type { ApiError, FinancialPreferences } from '../src/types';
import { authenticated, requireFirebaseAuth } from './auth';
import {
  completeOperation,
  consumeFirebaseSignInExchange,
  consumeOAuthState,
  createFirebaseSignInExchange,
  deleteConnection,
  getConnection,
  getOrCreateOperation,
  getOAuthStatePurpose,
  toPublicConnection,
} from './connectionStore';
import { getAppUrl, validateRuntimeConfiguration } from './config';
import { AppError, errors, toApiError } from './errors';
import {
  limitAuthenticatedApi,
  limitFirebaseSignInExchange,
  limitGoogleOAuthCallback,
  limitGoogleOAuthStart,
  limitGoogleSignInStart,
  limitInboundApi,
  limitPublicSupportReport,
} from './rateLimit';
import { createSupportReport, type SupportReportCategory } from './reports';
import {
  beginGoogleAuthorization,
  beginGoogleSignIn,
  finishGoogleAuthorization,
  finishGoogleSignIn,
  revokeGoogleAuthorization,
} from './googleAuth';
import {
  appendTransaction,
  ensureFinancialSpreadsheet,
  loadFinancialSnapshot,
  purgeFinancialData,
  softDeleteAllTransactions,
  softDeleteTransaction,
  updatePreferences,
  updateTransaction,
  upsertBudget,
  type BudgetWriteInput,
  type TransactionWriteInput,
} from './sheets';

const paymentMethods = ['Efectivo', 'Tarjeta Débito', 'Tarjeta Crédito', 'Transferencia'] as const;
const costTypes = ['Fijo', 'Variable', 'Discrecional', 'Operativo', 'Hormiga', 'Ingreso'] as const;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato YYYY-MM-DD.');
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https://*.googleusercontent.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://www.gstatic.com",
  "script-src 'self' https://www.gstatic.com",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.gstatic.com https://accounts.google.com",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
  "font-src 'self' data:",
].join('; ');
const transactionInputSchema = z.object({
  amount: z.coerce.number().finite().positive('El monto debe ser mayor que cero.'),
  type: z.enum(['income', 'expense']),
  description: z.string().trim().min(1, 'Ingresa una descripción.').max(240),
  categoryId: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1, 'Selecciona una categoría.').max(120),
  costType: z.enum(costTypes),
  fixedVariable: z.enum(['Fijo', 'Variable']).optional(),
  necessity: z.enum(['Necesario', 'Innecesario']).optional(),
  influence: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  date: dateSchema,
  paymentMethod: z.enum(paymentMethods),
  account: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2_000).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  recurring: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (value.type === 'income') return;
  if (value.costType === 'Ingreso') context.addIssue({ code: 'custom', path: ['costType'], message: 'Un gasto no puede usar la clasificación Ingreso.' });
  if (!value.fixedVariable) context.addIssue({ code: 'custom', path: ['fixedVariable'], message: 'Selecciona si el gasto es fijo o variable.' });
  if (!value.necessity) context.addIssue({ code: 'custom', path: ['necessity'], message: 'Selecciona si el gasto era necesario o innecesario.' });
  if (!value.influence) context.addIssue({ code: 'custom', path: ['influence'], message: 'Selecciona una influencia del 1 al 5.' });
});

const transactionUpdateSchema = z.object({
  expectedUpdatedAt: z.string().datetime({ message: 'La versión del movimiento no es válida.' }),
  transaction: transactionInputSchema,
}).strict();

const transactionDeleteSchema = z.object({
  expectedUpdatedAt: z.string().datetime({ message: 'La versión del movimiento no es válida.' }),
}).strict();

const budgetInputSchema = z.object({
  expectedUpdatedAt: z.string().datetime({ message: 'La versión del presupuesto no es válida.' }).optional(),
  categoryId: z.string().trim().min(1).max(100),
  amount: z.coerce.number().finite().nonnegative(),
  period: z.string().trim().min(1).max(60),
  startDate: dateSchema,
  endDate: dateSchema,
  active: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.endDate < value.startDate) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'La fecha final debe ser posterior a la inicial.' });
  }
});

const preferencesInputSchema = z.object({
  expectedUpdatedAt: z.string().datetime({ message: 'La versión de la configuración no es válida.' }),
  currency: z.string().trim().min(1).max(10).optional(),
  dateFormat: z.string().trim().min(1).max(30).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  monthlyBudget: z.coerce.number().finite().nonnegative().optional(),
}).strict().refine(({ expectedUpdatedAt: _expectedUpdatedAt, ...preferences }) => Object.keys(preferences).length > 0, 'Envía al menos una preferencia.');

const supportReportSchema = z.object({
  category: z.enum(['bug', 'idea', 'other']),
  message: z.string().trim().min(12, 'Cuéntanos un poco más para poder entender el reporte.').max(2_000),
  email: z.union([
    z.string().trim().email('Ingresa un correo válido.').max(320),
    z.literal(''),
  ]).optional(),
  // Honeypot. Human users never see this control; automated submissions that
  // fill it are accepted without being persisted, which avoids bot feedback.
  website: z.string().trim().max(250).optional(),
}).strict();

function responseData<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data });
}

function apiErrorFromZod(error: ZodError): AppError {
  const issue = error.issues[0];
  return errors.validation(issue?.message ?? 'Los datos enviados no son válidos.');
}

function parseInput<T>(schema: z.ZodType<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) throw apiErrorFromZod(error);
    throw error;
  }
}

function getIdempotencyKey(req: Request): string {
  const key = req.header('Idempotency-Key')?.trim();
  if (!key || key.length < 8 || key.length > 200) {
    throw errors.validation('Incluye un Idempotency-Key válido para registrar el movimiento.');
  }
  return key;
}

function hashRequest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

type GoogleCallbackResult = 'connected' | 'error' | 'reauthorization_required' | 'configuration_error';

function callbackUrl(result: GoogleCallbackResult): string {
  return `${getAppUrl()}/#/app?google=${result}`;
}

function googleCallbackResult(error: unknown): GoogleCallbackResult {
  if (!(error instanceof AppError)) return 'error';
  if (error.code === 'GOOGLE_REAUTH_REQUIRED') return 'reauthorization_required';
  if (error.code === 'CONFIGURATION_ERROR') return 'configuration_error';
  return 'error';
}

const SIGN_IN_EXCHANGE_TTL_MS = 5 * 60 * 1000;

function isSecureRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

function signInExchangeCookieName(): string {
  return isSecureRuntime() ? '__Host-billqo-sign-in' : 'billqo-sign-in';
}

function signInExchangeCookieOptions() {
  return {
    httpOnly: true,
    secure: isSecureRuntime(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SIGN_IN_EXCHANGE_TTL_MS,
  };
}

function clearSignInExchangeCookieOptions() {
  const { maxAge: _maxAge, ...options } = signInExchangeCookieOptions();
  return options;
}

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.header('cookie');
  if (!raw) return undefined;
  for (const segment of raw.split(';')) {
    const separator = segment.indexOf('=');
    if (separator < 1) continue;
    if (segment.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(segment.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function signInCallbackUrl(result: 'google' | 'error'): string {
  return `${getAppUrl()}/?auth=${result}#/auth`;
}

function requestErrorStatus(error: unknown): number {
  return error instanceof AppError ? error.status : 500;
}

const app = express();

// Vercel imports this module directly instead of server.ts. Validate secure
// runtime configuration during the production function cold start as well.
if (process.env.VERCEL === '1' && process.env.NODE_ENV !== 'test') {
  validateRuntimeConfiguration();
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));

// Local diagnostics deliberately omit bodies, authorization headers, user IDs and
// provider data. They let us distinguish a browser-network failure from an API
// response while keeping credentials out of the development log.
if (process.env.NODE_ENV !== 'production') {
  app.use('/api', (req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      console.info('[billqo:api]', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
    next();
  });
}

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Firebase's popup flow needs the opener relationship to remain available.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  }
  next();
});

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  next();
});

app.get('/api/health', (_req, res) => {
  responseData(res, { status: 'ok', timestamp: new Date().toISOString() });
});

/** Public, validated support intake. It never grants Firestore client access. */
app.post('/api/reports', limitPublicSupportReport, async (req, res, next) => {
  try {
    const input = parseInput(supportReportSchema, req.body);
    if (input.website) {
      responseData(res, { status: 'received' }, 202);
      return;
    }
    await createSupportReport({
      category: input.category as SupportReportCategory,
      message: input.message,
      email: input.email || undefined,
    });
    responseData(res, { status: 'received' }, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * Initial Google sign-in. The server owns the OAuth authorization-code flow,
 * so Safari and embedded browsers never depend on Firebase's redirect helper.
 */
app.get('/api/auth/google/start', limitGoogleSignInStart, async (_req, res, next) => {
  try {
    const authorizationUrl = await beginGoogleSignIn();
    res.redirect(303, authorizationUrl);
  } catch (error) {
    next(error);
  }
});

/** Consume the short-lived OAuth callback exchange exactly once. */
app.post('/api/auth/firebase-token', limitFirebaseSignInExchange, async (req, res, next) => {
  try {
    const name = signInExchangeCookieName();
    const exchange = readCookie(req, name);
    res.clearCookie(name, clearSignInExchangeCookieOptions());
    if (!exchange) {
      res.status(204).end();
      return;
    }

    const customToken = await consumeFirebaseSignInExchange(exchange);
    if (!customToken) {
      res.status(204).end();
      return;
    }
    responseData(res, { customToken });
  } catch (error) {
    next(error);
  }
});

// This handler consumes only first-login states. Existing authenticated users
// still use the Sheets reconnect handler immediately below.
app.get('/api/google/oauth/callback', limitGoogleOAuthCallback, async (req, res, next) => {
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  let purpose: 'sign_in' | 'sheets' | undefined;
  try {
    purpose = state ? await getOAuthStatePurpose(state) : undefined;
    if (purpose !== 'sign_in') {
      next();
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const denied = typeof req.query.error === 'string';
    if (!code || denied) {
      if (denied && state) await consumeOAuthState(state).catch(() => undefined);
      throw errors.reauthorization();
    }

    const { uid, customToken } = await finishGoogleSignIn(code, state!);
    try {
      await ensureFinancialSpreadsheet(uid);
    } catch (error) {
      // Authentication succeeds even if provisioning needs a retry. The
      // dashboard will call /storage/ensure with the verified Firebase token.
      console.warn('Initial financial storage provisioning deferred', error instanceof Error ? error.name : 'unknown_error');
    }
    const exchange = await createFirebaseSignInExchange(customToken);
    res.cookie(signInExchangeCookieName(), exchange, signInExchangeCookieOptions());
    res.redirect(303, signInCallbackUrl('google'));
  } catch (error) {
    if (purpose !== 'sign_in') {
      // Let the established Sheets callback preserve its stable redirect
      // behavior when this preliminary state lookup cannot run (for example,
      // a test or an unavailable metadata store).
      next();
      return;
    }
    res.clearCookie(signInExchangeCookieName(), clearSignInExchangeCookieOptions());
    res.redirect(303, signInCallbackUrl('error'));
    if (!(error instanceof AppError)) console.error('Google sign-in callback failed', error instanceof Error ? error.name : 'unknown_error');
  }
});

app.get('/api/google/oauth/callback', async (req, res, next) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const denied = typeof req.query.error === 'string';
    if (!code || !state || denied) {
      // A user cancellation must invalidate the one-time state too. The
      // provider error is deliberately not returned to the browser.
      if (state && denied) await consumeOAuthState(state).catch(() => undefined);
      throw errors.reauthorization('La autorización con Google no se completó. Puedes intentarlo de nuevo.');
    }
    const { uid } = await finishGoogleAuthorization(code, state);
    await ensureFinancialSpreadsheet(uid);
    res.redirect(303, callbackUrl('connected'));
  } catch (error) {
    // The user only receives a stable state, never provider details or tokens.
    res.redirect(303, callbackUrl(googleCallbackResult(error)));
    if (!(error instanceof AppError)) console.error('Google OAuth callback failed', error instanceof Error ? error.name : 'unknown_error');
  }
});

// This distributed IP limiter runs before Firebase token verification so a
// burst of invalid tokens cannot consume unlimited authentication work.
app.use('/api', limitInboundApi);
app.use('/api', requireFirebaseAuth);
app.use('/api', limitAuthenticatedApi);

app.get('/api/connection', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    responseData(res, toPublicConnection(await getConnection(uid)));
  } catch (error) {
    next(error);
  }
});

app.post('/api/google/oauth/start', limitGoogleOAuthStart, async (req, res, next) => {
  try {
    const identity = authenticated(req);
    // The Firebase Google session is bound to the same Google account that owns the Sheet.
    const googleEmail = identity.provider === 'google.com' ? identity.email : undefined;
    const authorizationUrl = await beginGoogleAuthorization(identity.uid, googleEmail);
    responseData(res, { authorizationUrl });
  } catch (error) {
    next(error);
  }
});

app.post('/api/storage/ensure', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    await ensureFinancialSpreadsheet(uid);
    responseData(res, toPublicConnection(await getConnection(uid)));
  } catch (error) {
    next(error);
  }
});

app.get('/api/finance', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    responseData(res, await loadFinancialSnapshot(uid));
  } catch (error) {
    next(error);
  }
});

app.post('/api/sync', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    responseData(res, await loadFinancialSnapshot(uid));
  } catch (error) {
    next(error);
  }
});

app.post('/api/transactions', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    const input = parseInput(transactionInputSchema, req.body) as TransactionWriteInput;
    const idempotencyKey = getIdempotencyKey(req);
    const operation = await getOrCreateOperation(uid, idempotencyKey, hashRequest(input));
    if (operation.state === 'processing') {
      throw errors.conflict('Este movimiento todavía se está guardando. Espera unos segundos y reintenta con el mismo Idempotency-Key.');
    }
    const transaction = await appendTransaction(uid, operation.transactionId, input);
    if (operation.state === 'new') await completeOperation(uid, idempotencyKey, transaction.id, operation.leaseId);
    responseData(res, transaction, operation.state === 'completed' ? 200 : 201);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/transactions/:id', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    const id = z.string().min(1).max(100).parse(req.params.id);
    const body = parseInput(transactionUpdateSchema, req.body);
    responseData(res, await updateTransaction(uid, id, body.expectedUpdatedAt, body.transaction as TransactionWriteInput));
  } catch (error) {
    next(error instanceof ZodError ? apiErrorFromZod(error) : error);
  }
});

app.delete('/api/transactions/:id', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    const id = z.string().min(1).max(100).parse(req.params.id);
    const body = parseInput(transactionDeleteSchema, req.body);
    await softDeleteTransaction(uid, id, body.expectedUpdatedAt);
    res.status(204).end();
  } catch (error) {
    next(error instanceof ZodError ? apiErrorFromZod(error) : error);
  }
});

// This remains intentionally separate from the individual DELETE endpoint because the existing UI offers it.
// It is a logical delete; no financial row is physically removed from the user's spreadsheet.
app.delete('/api/transactions', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    await softDeleteAllTransactions(uid);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete('/api/financial-data', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    await purgeFinancialData(uid);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.put('/api/budgets/:id', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    const id = z.string().min(1).max(100).parse(req.params.id);
    const body = parseInput(budgetInputSchema, req.body);
    responseData(res, await upsertBudget(uid, { ...body, id } as BudgetWriteInput));
  } catch (error) {
    next(error instanceof ZodError ? apiErrorFromZod(error) : error);
  }
});

app.put('/api/preferences', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    const body = parseInput(preferencesInputSchema, req.body);
    const { expectedUpdatedAt, ...preferences } = body;
    responseData(res, await updatePreferences(uid, preferences as Partial<Pick<FinancialPreferences, 'currency' | 'dateFormat' | 'timezone' | 'monthlyBudget'>>, expectedUpdatedAt));
  } catch (error) {
    next(error);
  }
});

app.post('/api/financial-insights', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    const snapshot = await loadFinancialSnapshot(uid);
    // No rows leave this server route for inference. The deterministic engine is fed by the
    // same normalized, validated snapshot used by the dashboard.
    const analytics = calculateAnalytics(snapshot.transactions, snapshot.budgets, { timezone: snapshot.preferences.timezone });
    responseData(res, buildDeterministicInsights(analytics, snapshot.transactions));
  } catch (error) {
    next(error);
  }
});

app.post('/api/google/disconnect', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    await revokeGoogleAuthorization(uid);
    await deleteConnection(uid);
    responseData(res, { status: 'not_connected' });
  } catch (error) {
    next(error);
  }
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const body: ApiError = toApiError(error);
  // Keep logs useful but deliberately omit request bodies, tokens and provider payloads.
  if (requestErrorStatus(error) >= 500) console.error('API request failed', error instanceof Error ? error.name : 'unknown_error');
  res.status(requestErrorStatus(error)).json({ error: body });
};

app.use(errorHandler);

export default app;
