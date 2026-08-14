import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { NextFunction, Request, Response } from 'express';
import { getAdminDb } from './firebaseAdmin';
import { errors } from './errors';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface FixedWindowRateLimiterOptions {
  scope?: string;
  maxRequests: number;
  windowMs: number;
  /**
   * Production API protection must remain coordinated across instances. A
   * local fallback is useful only for development and isolated tests, where a
   * Firestore emulator or credentials may not be available.
   */
  failureMode?: 'local-fallback' | 'deny';
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const RATE_LIMIT_BUCKETS = 'rateLimitBuckets';
const RATE_LIMIT_BUCKET_TTL_MS = 24 * 60 * 60 * 1_000;
const RATE_LIMIT_SWEEP_INTERVAL_MS = 5 * 60 * 1_000;
const RATE_LIMIT_SWEEP_BATCH_SIZE = 50;
let lastRateLimitSweepAt = 0;

function assertRateLimitOptions({ maxRequests, windowMs }: FixedWindowRateLimiterOptions): void {
  if (!Number.isInteger(maxRequests) || maxRequests < 1) throw new Error('maxRequests must be a positive integer.');
  if (!Number.isInteger(windowMs) || windowMs < 1) throw new Error('windowMs must be a positive integer.');
}

function retryAfterSeconds(resetAt: number, now: number): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1_000));
}

function hashSubject(scope: string, subject: string): string {
  return createHash('sha256').update(`${scope}:${subject}`).digest('base64url');
}

function windowStartAt(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs;
}

export function resolveDistributedRateLimitFailureMode(
  options: Pick<FixedWindowRateLimiterOptions, 'failureMode'>,
): 'local-fallback' | 'deny' {
  if (options.failureMode) return options.failureMode;
  return process.env.NODE_ENV === 'production' ? 'deny' : 'local-fallback';
}

function scheduleExpiredBucketSweep(): void {
  const now = Date.now();
  if (now - lastRateLimitSweepAt < RATE_LIMIT_SWEEP_INTERVAL_MS) return;
  lastRateLimitSweepAt = now;

  void (async () => {
    const database = getAdminDb();
    const expired = await database.collection(RATE_LIMIT_BUCKETS)
      .where('expiresAt', '<=', Timestamp.fromMillis(now))
      .limit(RATE_LIMIT_SWEEP_BATCH_SIZE)
      .get();
    if (expired.empty) return;
    const batch = database.batch();
    for (const document of expired.docs) batch.delete(document.ref);
    await batch.commit();
  })().catch(() => undefined);
}

/**
 * Cross-instance fixed-window limiter. It persists only a hashed subject and
 * short-lived counter in Firestore, so Vercel cold starts and concurrent
 * functions share the same quota without storing financial data or raw IPs.
 */
export function createFirestoreFixedWindowRateLimiter(options: FixedWindowRateLimiterOptions) {
  assertRateLimitOptions(options);
  const fallback = createFixedWindowRateLimiter(options);
  const failureMode = resolveDistributedRateLimitFailureMode(options);

  return {
    async consume(subject: string, now = Date.now()): Promise<RateLimitResult> {
      const windowStart = windowStartAt(now, options.windowMs);
      const resetAt = windowStart + options.windowMs;
      const scope = options.scope?.trim() || 'default';
      const subjectHash = hashSubject(scope, subject);
      const bucketId = createHash('sha256')
        .update(`${subjectHash}:${windowStart}`)
        .digest('base64url');
      try {
        const database = getAdminDb();
        const bucket = database.collection(RATE_LIMIT_BUCKETS).doc(bucketId);
        scheduleExpiredBucketSweep();

        return await database.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(bucket);
          const storedCount = snapshot.exists && Number.isInteger(snapshot.data().count)
            ? Number(snapshot.data().count)
            : 0;
          const result = { allowed: storedCount < options.maxRequests, retryAfterSeconds: retryAfterSeconds(resetAt, now) };
          if (!result.allowed) return result;

          transaction.set(bucket, {
            scope,
            subjectHash,
            count: storedCount + 1,
            windowStartedAt: Timestamp.fromMillis(windowStart),
            resetAt: Timestamp.fromMillis(resetAt),
            expiresAt: Timestamp.fromMillis(resetAt + RATE_LIMIT_BUCKET_TTL_MS),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          return result;
        });
      } catch (error) {
        if (failureMode === 'deny') {
          // Never silently turn a distributed production limit into
          // per-instance limits during a Firestore outage.
          console.error('Distributed rate limit unavailable; refusing request', error instanceof Error ? error.name : 'unknown_error');
          throw errors.configuration('El control de seguridad temporalmente no esta disponible. Intentalo de nuevo.');
        }

        // Local development and isolated tests can run without Firestore.
        console.warn('Distributed rate limit unavailable; using local fallback', error instanceof Error ? error.name : 'unknown_error');
        return fallback.consume(subject, now);
      }
    },
  };
}

// Kept as a small pure primitive for deterministic unit tests and local
// diagnostics; production middleware below uses the Firestore-backed limiter.
export function createFixedWindowRateLimiter({ maxRequests, windowMs }: FixedWindowRateLimiterOptions) {
  assertRateLimitOptions({ maxRequests, windowMs });
  const buckets = new Map<string, RateLimitBucket>();

  return {
    consume(subject: string, now = Date.now()): RateLimitResult {
      const existing = buckets.get(subject);
      const bucket = !existing || existing.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : existing;

      if (bucket.count >= maxRequests) {
        return { allowed: false, retryAfterSeconds: retryAfterSeconds(bucket.resetAt, now) };
      }

      bucket.count += 1;
      buckets.set(subject, bucket);
      return { allowed: true, retryAfterSeconds: retryAfterSeconds(bucket.resetAt, now) };
    },
  };
}

type SubjectResolver = (req: Request) => string | undefined;
type DistributedRateLimiter = ReturnType<typeof createFirestoreFixedWindowRateLimiter>;

function rateLimitMiddleware(limiter: DistributedRateLimiter, subjectResolver: SubjectResolver) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const subject = subjectResolver(req);
      if (!subject) {
        next(errors.authentication());
        return;
      }

      try {
        const result = await limiter.consume(subject);
        if (result.allowed) {
          next();
          return;
        }
        res.setHeader('Retry-After', String(result.retryAfterSeconds));
        next(errors.rateLimited());
      } catch (error) {
        console.error('Distributed rate limit failed', error instanceof Error ? error.name : 'unknown_error');
        next(errors.internal('No pudimos verificar el limite de solicitudes. Intentalo de nuevo.'));
      }
    })();
  };
}

function clientAddress(req: Request): string {
  // app.set('trust proxy', 1) makes req.ip use Vercel's trusted forwarding
  // address while preserving a safe local-development fallback.
  return req.ip || req.socket.remoteAddress || 'unknown';
}

const inboundApiLimiter = createFirestoreFixedWindowRateLimiter({
  scope: 'inbound-api',
  maxRequests: 240,
  windowMs: 60_000,
});

const authenticatedApiLimiter = createFirestoreFixedWindowRateLimiter({
  scope: 'authenticated-api',
  maxRequests: 120,
  windowMs: 60_000,
});

const oauthStartLimiter = createFirestoreFixedWindowRateLimiter({
  scope: 'google-oauth-start',
  maxRequests: 10,
  windowMs: 10 * 60_000,
});

const googleSignInStartLimiter = createFirestoreFixedWindowRateLimiter({
  scope: 'google-sign-in-start',
  maxRequests: 10,
  windowMs: 10 * 60_000,
});

const googleOAuthCallbackLimiter = createFirestoreFixedWindowRateLimiter({
  scope: 'google-oauth-callback',
  maxRequests: 30,
  windowMs: 10 * 60_000,
});

const firebaseSignInExchangeLimiter = createFirestoreFixedWindowRateLimiter({
  scope: 'firebase-sign-in-exchange',
  maxRequests: 20,
  windowMs: 10 * 60_000,
});

const publicSupportReportLimiter = createFirestoreFixedWindowRateLimiter({
  scope: 'public-support-report',
  maxRequests: 3,
  windowMs: 60 * 60_000,
});

export const limitInboundApi = rateLimitMiddleware(inboundApiLimiter, clientAddress);
export const limitAuthenticatedApi = rateLimitMiddleware(authenticatedApiLimiter, (req) => req.authContext?.uid);
export const limitGoogleOAuthStart = rateLimitMiddleware(oauthStartLimiter, (req) => req.authContext?.uid);
export const limitGoogleSignInStart = rateLimitMiddleware(googleSignInStartLimiter, clientAddress);
export const limitGoogleOAuthCallback = rateLimitMiddleware(googleOAuthCallbackLimiter, clientAddress);
export const limitFirebaseSignInExchange = rateLimitMiddleware(firebaseSignInExchangeLimiter, clientAddress);
export const limitPublicSupportReport = rateLimitMiddleware(publicSupportReportLimiter, clientAddress);
