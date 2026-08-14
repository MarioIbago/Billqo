import { createHash, randomBytes } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { GoogleConnection, GoogleConnectionStatus } from '../src/types';
import { decryptSecret, encryptSecret, type EncryptedSecret } from './crypto';
import { getAdminDb } from './firebaseAdmin';
import { errors } from './errors';

const CONNECTIONS = 'googleConnections';
const OAUTH_STATES = 'oauthStates';
const FIREBASE_SIGN_IN_EXCHANGES = 'firebaseSignInExchanges';
const OPERATIONS = 'financialOperations';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const FIREBASE_SIGN_IN_EXCHANGE_TTL_MS = 5 * 60 * 1000;
const OPERATION_TTL_MS = 24 * 60 * 60 * 1000;
const OPERATION_LEASE_TTL_MS = 5 * 60 * 1000;
const LEASE_TTL_MS = 90 * 1000;
const METADATA_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const METADATA_SWEEP_BATCH_SIZE = 25;
const lastMetadataSweepAt = new Map<string, number>();

export interface ConnectionRecord {
  status: GoogleConnectionStatus;
  googleSubject?: string;
  spreadsheetId?: string;
  schemaVersion?: number;
  refreshToken?: EncryptedSecret;
  scopes?: string[];
  lastSyncAt?: string;
  leaseId?: string;
  leaseExpiresAt?: Date;
}

export type OAuthStateRecord =
  | {
    purpose: 'sheets';
    uid: string;
    email?: string;
    codeVerifier: string;
  }
  | {
    purpose: 'sign_in';
    codeVerifier: string;
  };

function connectionRef(uid: string) {
  return getAdminDb().collection(CONNECTIONS).doc(uid);
}

async function sweepExpiredMetadata(collection: string): Promise<void> {
  const now = Date.now();
  const lastSweep = lastMetadataSweepAt.get(collection) ?? 0;
  if (now - lastSweep < METADATA_SWEEP_INTERVAL_MS) return;
  lastMetadataSweepAt.set(collection, now);

  const db = getAdminDb();
  const expired = await db.collection(collection)
    .where('expiresAt', '<=', Timestamp.fromMillis(now))
    .limit(METADATA_SWEEP_BATCH_SIZE)
    .get();
  if (expired.empty) return;

  const batch = db.batch();
  for (const document of expired.docs) batch.delete(document.ref);
  await batch.commit();
}

function requestMetadataSweep(collection: string): void {
  void sweepExpiredMetadata(collection).catch(() => undefined);
}

function timestampToIso(value: unknown): string | undefined {
  return value instanceof Timestamp ? value.toDate().toISOString() : undefined;
}

function timestampToDate(value: unknown): Date | undefined {
  return value instanceof Timestamp ? value.toDate() : undefined;
}

function asEncryptedSecret(value: unknown): EncryptedSecret | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  if (typeof source.ciphertext !== 'string' || typeof source.iv !== 'string' || typeof source.authTag !== 'string' || typeof source.version !== 'string') {
    return undefined;
  }
  return {
    ciphertext: source.ciphertext,
    iv: source.iv,
    authTag: source.authTag,
    version: source.version,
  };
}

function parseConnection(data?: Record<string, unknown>): ConnectionRecord | undefined {
  if (!data) return undefined;
  const status = typeof data.status === 'string' ? data.status as GoogleConnectionStatus : 'not_connected';
  return {
    status,
    googleSubject: typeof data.googleSubject === 'string' ? data.googleSubject : undefined,
    spreadsheetId: typeof data.spreadsheetId === 'string' ? data.spreadsheetId : undefined,
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : undefined,
    refreshToken: asEncryptedSecret(data.refreshToken),
    scopes: Array.isArray(data.scopes) ? data.scopes.filter((scope): scope is string => typeof scope === 'string') : undefined,
    lastSyncAt: timestampToIso(data.lastSyncAt),
    leaseId: typeof data.leaseId === 'string' ? data.leaseId : undefined,
    leaseExpiresAt: timestampToDate(data.leaseExpiresAt),
  };
}

export async function getConnection(uid: string): Promise<ConnectionRecord | undefined> {
  const snapshot = await connectionRef(uid).get();
  return snapshot.exists ? parseConnection(snapshot.data()) : undefined;
}

export function toPublicConnection(record?: ConnectionRecord): GoogleConnection {
  if (!record) return { status: 'not_connected' };
  return {
    status: record.status,
    spreadsheetId: record.spreadsheetId,
    spreadsheetUrl: record.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(record.spreadsheetId)}/edit` : undefined,
    schemaVersion: record.schemaVersion,
    lastSyncAt: record.lastSyncAt,
  };
}

export async function saveAuthorizedConnection(
  uid: string,
  input: { googleSubject: string; refreshToken?: EncryptedSecret; scopes: string[] },
): Promise<void> {
  const ref = connectionRef(uid);
  await getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = snapshot.exists ? parseConnection(snapshot.data()) : undefined;
    const refreshToken = input.refreshToken ?? previous?.refreshToken;
    if (!refreshToken) {
      throw errors.reauthorization('Google no devolvió un permiso persistente. Vuelve a intentar la conexión.');
    }
    const next = {
      status: previous?.spreadsheetId ? 'connected' : 'authorized',
      googleSubject: input.googleSubject,
      refreshToken,
      scopes: input.scopes,
      updatedAt: FieldValue.serverTimestamp(),
    } as Record<string, unknown>;
    if (!previous) next.createdAt = FieldValue.serverTimestamp();
    transaction.set(ref, next, { merge: true });
  });
}

export async function markConnectionStatus(uid: string, status: GoogleConnectionStatus): Promise<void> {
  await connectionRef(uid).set({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function markConnected(uid: string, spreadsheetId: string, schemaVersion: number): Promise<void> {
  await connectionRef(uid).set({
    status: 'connected',
    spreadsheetId,
    schemaVersion,
    lastSyncAt: FieldValue.serverTimestamp(),
    leaseId: FieldValue.delete(),
    leaseExpiresAt: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function touchLastSync(uid: string): Promise<void> {
  await connectionRef(uid).set({
    lastSyncAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function acquireProvisionLease(uid: string): Promise<{ kind: 'existing'; spreadsheetId: string } | { kind: 'busy' } | { kind: 'acquired'; leaseId: string }> {
  const ref = connectionRef(uid);
  return getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const record = snapshot.exists ? parseConnection(snapshot.data()) : undefined;
    if (!record?.refreshToken) throw errors.reauthorization();
    if (record.spreadsheetId) return { kind: 'existing', spreadsheetId: record.spreadsheetId };
    if (record.leaseExpiresAt && record.leaseExpiresAt.getTime() > Date.now()) return { kind: 'busy' };

    const leaseId = randomBytes(18).toString('base64url');
    transaction.set(ref, {
      status: 'provisioning',
      leaseId,
      leaseExpiresAt: Timestamp.fromMillis(Date.now() + LEASE_TTL_MS),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { kind: 'acquired', leaseId };
  });
}

export async function releaseProvisionLease(uid: string, leaseId: string, status: GoogleConnectionStatus = 'authorized'): Promise<void> {
  const ref = connectionRef(uid);
  await getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const record = snapshot.exists ? parseConnection(snapshot.data()) : undefined;
    if (!record || record.leaseId !== leaseId) return;
    transaction.update(ref, {
      status,
      leaseId: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

function hashState(state: string): string {
  return createHash('sha256').update(`oauth-state:${state}`).digest('hex');
}

export async function createOAuthState(uid: string, email: string | undefined, codeVerifier: string): Promise<string> {
  requestMetadataSweep(OAUTH_STATES);
  const state = randomBytes(32).toString('base64url');
  await getAdminDb().collection(OAUTH_STATES).doc(hashState(state)).set({
    purpose: 'sheets',
    uid,
    email: email ?? null,
    codeVerifier,
    expiresAt: Timestamp.fromMillis(Date.now() + OAUTH_STATE_TTL_MS),
    createdAt: FieldValue.serverTimestamp(),
  });
  return state;
}

export async function consumeOAuthState(state: string): Promise<OAuthStateRecord> {
  const ref = getAdminDb().collection(OAUTH_STATES).doc(hashState(state));
  return getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw errors.reauthorization('La solicitud de conexión ya no es válida. Inténtalo de nuevo.');
    const data = snapshot.data();
    const expiresAt = timestampToDate(data.expiresAt);
    if (!expiresAt || expiresAt.getTime() < Date.now() || data.usedAt) {
      transaction.delete(ref);
      throw errors.reauthorization('La solicitud de conexión venció. Inténtalo de nuevo.');
    }
    if (typeof data.codeVerifier !== 'string' || (data.purpose !== 'sheets' && data.purpose !== 'sign_in')) {
      transaction.delete(ref);
      throw errors.reauthorization('No pudimos validar la conexión con Google.');
    }
    transaction.delete(ref);
    if (data.purpose === 'sign_in') return { purpose: 'sign_in', codeVerifier: data.codeVerifier };
    if (typeof data.uid !== 'string') throw errors.reauthorization();
    return {
      purpose: 'sheets',
      uid: data.uid,
      email: typeof data.email === 'string' ? data.email : undefined,
      codeVerifier: data.codeVerifier,
    };
  });
}

/**
 * Creates an OAuth state for the first Google sign-in.  It intentionally has
 * no Firebase uid yet: that uid is resolved only after the server verifies
 * Google's ID token in the callback.
 */
export async function createGoogleSignInState(codeVerifier: string): Promise<string> {
  requestMetadataSweep(OAUTH_STATES);
  const state = randomBytes(32).toString('base64url');
  await getAdminDb().collection(OAUTH_STATES).doc(hashState(state)).set({
    purpose: 'sign_in',
    codeVerifier,
    expiresAt: Timestamp.fromMillis(Date.now() + OAUTH_STATE_TTL_MS),
    createdAt: FieldValue.serverTimestamp(),
  });
  return state;
}

/**
 * Looks up only the callback destination. The opaque state itself remains
 * server-side and is still consumed atomically by consumeOAuthState.
 */
export async function getOAuthStatePurpose(state: string): Promise<OAuthStateRecord['purpose'] | undefined> {
  const snapshot = await getAdminDb().collection(OAUTH_STATES).doc(hashState(state)).get();
  if (!snapshot.exists) return undefined;
  const data = snapshot.data();
  const expiresAt = timestampToDate(data.expiresAt);
  if (!expiresAt || expiresAt.getTime() < Date.now()) return undefined;
  return data.purpose === 'sign_in' || data.purpose === 'sheets' ? data.purpose : undefined;
}

/**
 * A Firebase custom token must never travel in a query string. This opaque,
 * encrypted, short-lived exchange code is delivered in an HttpOnly cookie and
 * consumed exactly once by the client after the OAuth callback.
 */
export async function createFirebaseSignInExchange(customToken: string): Promise<string> {
  requestMetadataSweep(FIREBASE_SIGN_IN_EXCHANGES);
  const exchange = randomBytes(32).toString('base64url');
  const exchangeId = createHash('sha256').update(`firebase-sign-in-exchange:${exchange}`).digest('hex');
  await getAdminDb().collection(FIREBASE_SIGN_IN_EXCHANGES).doc(exchangeId).set({
    customToken: encryptSecret(customToken),
    expiresAt: Timestamp.fromMillis(Date.now() + FIREBASE_SIGN_IN_EXCHANGE_TTL_MS),
    createdAt: FieldValue.serverTimestamp(),
  });
  return exchange;
}

export async function consumeFirebaseSignInExchange(exchange: string): Promise<string | undefined> {
  const exchangeId = createHash('sha256').update(`firebase-sign-in-exchange:${exchange}`).digest('hex');
  const ref = getAdminDb().collection(FIREBASE_SIGN_IN_EXCHANGES).doc(exchangeId);
  const encrypted = await getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return undefined;
    const data = snapshot.data();
    const expiresAt = timestampToDate(data.expiresAt);
    const secret = asEncryptedSecret(data.customToken);
    transaction.delete(ref);
    if (!expiresAt || expiresAt.getTime() < Date.now() || !secret) return undefined;
    return secret;
  });
  if (!encrypted) return undefined;

  try {
    return decryptSecret(encrypted);
  } catch {
    return undefined;
  }
}

export type IdempotencyOperation =
  | { state: 'new'; transactionId: string; leaseId: string }
  | { state: 'processing' | 'completed'; transactionId: string };

export async function getOrCreateOperation(uid: string, idempotencyKey: string, requestHash: string): Promise<IdempotencyOperation> {
  requestMetadataSweep(OPERATIONS);
  const hash = createHash('sha256').update(`${uid}:${idempotencyKey}`).digest('hex');
  const ref = getAdminDb().collection(OPERATIONS).doc(hash);
  return getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const now = Date.now();
    if (snapshot.exists && snapshot.data().expiresAt instanceof Timestamp && snapshot.data().expiresAt.toMillis() > now) {
      const data = snapshot.data();
      const transactionId = typeof data.transactionId === 'string' ? data.transactionId : randomBytes(16).toString('hex');
      if (typeof data.transactionId !== 'string') transaction.update(ref, { transactionId });
      if (typeof data.requestHash === 'string' && data.requestHash !== requestHash) {
        throw errors.conflict('Este Idempotency-Key ya se usó con un movimiento distinto.');
      }
      if (data.status === 'completed') return { state: 'completed', transactionId };
      const leaseExpiresAt = timestampToDate(data.leaseExpiresAt);
      if (leaseExpiresAt && leaseExpiresAt.getTime() > now) return { state: 'processing', transactionId };
      const leaseId = randomBytes(18).toString('base64url');
      transaction.set(ref, {
        status: 'pending',
        requestHash,
        transactionId,
        leaseId,
        leaseExpiresAt: Timestamp.fromMillis(now + OPERATION_LEASE_TTL_MS),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { state: 'new', transactionId, leaseId };
    }
    const transactionId = randomBytes(16).toString('hex');
    const leaseId = randomBytes(18).toString('base64url');
    transaction.set(ref, {
      uidHash: createHash('sha256').update(uid).digest('hex'),
      status: 'pending',
      transactionId,
      requestHash,
      leaseId,
      leaseExpiresAt: Timestamp.fromMillis(now + OPERATION_LEASE_TTL_MS),
      expiresAt: Timestamp.fromMillis(now + OPERATION_TTL_MS),
      createdAt: FieldValue.serverTimestamp(),
    });
    return { state: 'new', transactionId, leaseId };
  });
}

export async function completeOperation(uid: string, idempotencyKey: string, transactionId: string, leaseId: string): Promise<void> {
  const hash = createHash('sha256').update(`${uid}:${idempotencyKey}`).digest('hex');
  const ref = getAdminDb().collection(OPERATIONS).doc(hash);
  await getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data().status === 'completed' || snapshot.data().leaseId !== leaseId) return;
    transaction.set(ref, {
      status: 'completed',
      transactionId,
      leaseId: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
      completedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

export async function deleteConnection(uid: string): Promise<void> {
  await connectionRef(uid).delete();
}
