import { auth } from './firebase';
import { buildDeterministicInsights, calculateAnalytics } from '../analytics';
import { browserIsOnline } from './network';
import {
  getOfflineQueue,
  getOfflineValue,
  mutateOfflineQueue,
  offlineOperation,
  setOfflineQueue,
  setOfflineValue,
  type OfflineOperation,
} from './offlineStore';
import type {
  AiInsightsResponse,
  ApiError,
  CategoryBudget,
  FinancialPreferences,
  FinancialSnapshot,
  GoogleConnection,
  ReceiptScanResult,
  Transaction,
  TransactionType,
} from '../types';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '');
const SNAPSHOT_KEY = 'finance:snapshot';
const CONNECTION_KEY = 'finance:connection';
const SYNC_ERRORS_KEY = 'finance:sync-errors';

export class FinancialApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: ApiError['code'] | 'NETWORK_ERROR' = 'NETWORK_ERROR',
    public readonly recoverable = true,
  ) {
    super(message);
    this.name = 'FinancialApiError';
  }
}

const apiCodes = new Set<ApiError['code']>([
  'AUTH_REQUIRED',
  'GOOGLE_REAUTH_REQUIRED',
  'SHEET_NOT_FOUND',
  'SHEET_SCHEMA_INVALID',
  'VALIDATION_FAILED',
  'CONFLICT',
  'RATE_LIMITED',
  'CONFIGURATION_ERROR',
  'GOOGLE_ERROR',
  'INTERNAL',
]);

type ApiEnvelope<T> = { data?: T; error?: Partial<ApiError> };

export type PublicReportCategory = 'bug' | 'idea' | 'other';

export interface PublicReportPayload {
  category: PublicReportCategory;
  message: string;
  email?: string;
  website?: string;
}

/** The initial Google callback is exchanged once, without an existing Firebase session. */
export function googleSignInStartUrl(): string {
  return `${API_BASE}/api/auth/google/start`;
}

export async function consumeFirebaseSignInExchange(): Promise<string | undefined> {
  if (!browserIsOnline()) {
    throw new FinancialApiError('Necesitas internet para iniciar sesión por primera vez.', 0, 'NETWORK_ERROR');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/auth/firebase-token`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new FinancialApiError('No pudimos comunicarnos con el servidor de Billqo.', 0, 'NETWORK_ERROR');
  }

  if (response.status === 204) return undefined;
  let body: ApiEnvelope<{ customToken?: unknown }> = {};
  try {
    body = await response.json() as ApiEnvelope<{ customToken?: unknown }>;
  } catch {
    throw new FinancialApiError('No pudimos completar el inicio de sesion.', response.status, 'INTERNAL');
  }
  if (!response.ok) {
    throw new FinancialApiError('No pudimos completar el inicio de sesion.', response.status, 'INTERNAL');
  }
  const customToken = body.data?.customToken;
  if (typeof customToken !== 'string' || customToken.length < 20) {
    throw new FinancialApiError('No pudimos validar el inicio de sesion.', response.status, 'AUTH_REQUIRED');
  }
  return customToken;
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new FinancialApiError('Tu sesión terminó. Vuelve a iniciar sesión.', 401, 'AUTH_REQUIRED');

  let token: string;
  try {
    token = await currentUser.getIdToken();
  } catch {
    throw new FinancialApiError('No pudimos validar tu sesión. Vuelve a iniciar sesión.', 401, 'AUTH_REQUIRED');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  const requestUrl = `${API_BASE}/api${path}`;
  try {
    response = await fetch(requestUrl, { ...init, headers, credentials: 'same-origin' });
  } catch (error) {
    console.error('[billqo:api] network request failed', {
      path,
      requestUrl,
      origin: window.location.origin,
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
    const localHint = import.meta.env.DEV
      ? ' Verifica que abriste Billqo en http://127.0.0.1:3001 y vuelve a intentarlo.'
      : '';
    throw new FinancialApiError(`No pudimos comunicarnos con el servidor de Billqo.${localHint}`, 0, 'NETWORK_ERROR');
  }

  if (response.status === 204) return undefined as T;

  let body: ApiEnvelope<T> = {};
  try {
    body = await response.json() as ApiEnvelope<T>;
  } catch {
    if (!response.ok) throw new FinancialApiError(`El servidor respondió con ${response.status}.`, response.status, 'INTERNAL');
  }

  if (!response.ok) {
    const error = body.error;
    const code = typeof error?.code === 'string' && apiCodes.has(error.code as ApiError['code'])
      ? error.code as ApiError['code']
      : response.status === 401 ? 'AUTH_REQUIRED' : 'INTERNAL';
    throw new FinancialApiError(
      error?.message || 'No pudimos completar la operación.',
      response.status,
      code,
      error?.recoverable ?? response.status >= 500,
    );
  }

  return body.data as T;
}

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new FinancialApiError('Tu sesión terminó. Vuelve a iniciar sesión.', 401, 'AUTH_REQUIRED');
  return uid;
}

function isNetworkError(error: unknown): boolean {
  return !browserIsOnline() || (error instanceof FinancialApiError && error.status === 0);
}

async function cachedSnapshot(uid = currentUid()): Promise<FinancialSnapshot | undefined> {
  return getOfflineValue<FinancialSnapshot>(uid, SNAPSHOT_KEY);
}

async function cacheSnapshot(snapshot: FinancialSnapshot, uid = currentUid()): Promise<FinancialSnapshot> {
  await setOfflineValue(uid, SNAPSHOT_KEY, snapshot);
  return snapshot;
}

async function cacheConnection(connection: GoogleConnection, uid = currentUid()): Promise<GoogleConnection> {
  await setOfflineValue(uid, CONNECTION_KEY, connection);
  return connection;
}

function recalculate(snapshot: FinancialSnapshot): FinancialSnapshot {
  const activeTransactions = snapshot.transactions.filter((item) => !item.deletedAt);
  const budgets = snapshot.budgets.map((budget) => {
    const spentAmount = activeTransactions
      .filter((transaction) => transaction.type === 'expense')
      .filter((transaction) => budget.categoryId ? transaction.categoryId === budget.categoryId : transaction.category === budget.category)
      .filter((transaction) => !budget.startDate || transaction.date >= budget.startDate)
      .filter((transaction) => !budget.endDate || transaction.date <= budget.endDate)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    return { ...budget, spentAmount };
  });
  return {
    ...snapshot,
    budgets,
    analytics: calculateAnalytics(snapshot.transactions, budgets, { timezone: snapshot.preferences.timezone }),
  };
}

async function updateCachedSnapshot(
  uid: string,
  update: (snapshot: FinancialSnapshot) => FinancialSnapshot,
): Promise<FinancialSnapshot | undefined> {
  const current = await cachedSnapshot(uid);
  if (!current) return undefined;
  const next = recalculate(update(current));
  await cacheSnapshot(next, uid);
  return next;
}

async function requireCachedSnapshot(uid = currentUid()): Promise<FinancialSnapshot> {
  const snapshot = await cachedSnapshot(uid);
  if (snapshot) return snapshot;
  throw new FinancialApiError(
    'Abre Billqo una vez con internet para preparar tus datos para uso sin conexión.',
    0,
    'NETWORK_ERROR',
  );
}

async function recordSyncError(uid: string, operation: OfflineOperation, error: unknown): Promise<void> {
  const current = (await getOfflineValue<Array<{ operation: OfflineOperation; message: string; at: string }>>(uid, SYNC_ERRORS_KEY)) ?? [];
  const message = error instanceof Error ? error.message : 'No pudimos sincronizar un cambio local.';
  await setOfflineValue(uid, SYNC_ERRORS_KEY, [...current.slice(-19), { operation, message, at: new Date().toISOString() }]);
}

function transactionFromPayload(payload: TransactionPayload, id: string, previous?: Transaction): Transaction {
  const now = new Date().toISOString();
  return {
    ...payload,
    id,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    recurringId: previous?.recurringId,
  };
}

function jsonBody(value: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(value) };
}

export type TransactionPayload = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'recurringId'>;

let flushPromise: Promise<void> | undefined;

export async function flushFinancialOfflineQueue(): Promise<void> {
  if (!browserIsOnline() || !auth.currentUser) return;
  if (flushPromise) return flushPromise;

  const uid = currentUid();
  flushPromise = (async () => {
    while (browserIsOnline()) {
      const queue = await getOfflineQueue(uid, 'finance');
      const operation = queue[0];
      if (!operation) return;

      try {
        const payload = operation.payload as Record<string, any>;
        if (operation.action === 'createTransaction') {
          const result = await apiRequest<Transaction>('/transactions', {
            method: 'POST',
            headers: { 'Idempotency-Key': String(payload.idempotencyKey) },
            body: JSON.stringify(payload.transaction),
          });
          await updateCachedSnapshot(uid, (snapshot) => ({
            ...snapshot,
            transactions: snapshot.transactions.map((item) => item.id === payload.localId ? result : item),
          }));
        } else if (operation.action === 'patchTransaction') {
          const result = await apiRequest<Transaction>(`/transactions/${encodeURIComponent(String(payload.id))}`, {
            method: 'PATCH',
            body: JSON.stringify({ expectedUpdatedAt: payload.expectedUpdatedAt, transaction: payload.transaction }),
          });
          await updateCachedSnapshot(uid, (snapshot) => ({
            ...snapshot,
            transactions: snapshot.transactions.map((item) => item.id === result.id ? result : item),
          }));
        } else if (operation.action === 'deleteTransaction') {
          await apiRequest<void>(`/transactions/${encodeURIComponent(String(payload.id))}`, {
            method: 'DELETE',
            body: JSON.stringify({ expectedUpdatedAt: payload.expectedUpdatedAt }),
          });
        } else if (operation.action === 'deleteAllTransactions') {
          await apiRequest<void>('/transactions', { method: 'DELETE' });
        } else if (operation.action === 'deleteFinancialData') {
          await apiRequest<void>('/financial-data', { method: 'DELETE' });
        } else if (operation.action === 'saveBudget') {
          const result = await apiRequest<CategoryBudget>(`/budgets/${encodeURIComponent(String(payload.id))}`, {
            method: 'PUT',
            body: JSON.stringify({ ...payload.input, ...(payload.expectedUpdatedAt ? { expectedUpdatedAt: payload.expectedUpdatedAt } : {}) }),
          });
          await updateCachedSnapshot(uid, (snapshot) => ({
            ...snapshot,
            budgets: [...snapshot.budgets.filter((item) => item.id !== result.id), result],
          }));
        } else if (operation.action === 'savePreferences') {
          const result = await apiRequest<FinancialPreferences>('/preferences', {
            method: 'PUT',
            body: JSON.stringify({ ...payload.preferences, expectedUpdatedAt: payload.expectedUpdatedAt }),
          });
          await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, preferences: result }));
        } else if (operation.action === 'disconnectGoogle') {
          await apiRequest<{ status: 'not_connected' }>('/google/disconnect', { method: 'POST' });
        }

        await setOfflineQueue(uid, 'finance', queue.slice(1));
      } catch (error) {
        if (isNetworkError(error) || (error instanceof FinancialApiError && (error.status === 401 || error.status >= 500))) return;
        await recordSyncError(uid, operation, error);
        await setOfflineQueue(uid, 'finance', queue.slice(1));
      }
    }
  })().finally(() => {
    flushPromise = undefined;
  });

  return flushPromise;
}

export async function submitPublicReport(report: PublicReportPayload): Promise<void> {
  if (!browserIsOnline()) {
    throw new FinancialApiError('Necesitas internet para enviar un reporte.', 0, 'NETWORK_ERROR');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/reports`, {
      method: 'POST',
      credentials: 'omit',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
  } catch {
    throw new FinancialApiError('No pudimos comunicarnos con el servidor de Billqo.', 0, 'NETWORK_ERROR');
  }

  let body: ApiEnvelope<{ status?: unknown }> = {};
  try {
    body = await response.json() as ApiEnvelope<{ status?: unknown }>;
  } catch {
    // Public endpoint error envelopes are optional.
  }

  if (!response.ok) {
    const error = body.error;
    const code = typeof error?.code === 'string' && apiCodes.has(error.code as ApiError['code'])
      ? error.code as ApiError['code']
      : 'INTERNAL';
    throw new FinancialApiError(
      error?.message || 'No pudimos enviar el reporte. Inténtalo de nuevo en un momento.',
      response.status,
      code,
      error?.recoverable ?? response.status >= 500,
    );
  }
}

export async function getConnection(): Promise<GoogleConnection> {
  const uid = currentUid();
  const cached = await getOfflineValue<GoogleConnection>(uid, CONNECTION_KEY);
  if (!browserIsOnline()) {
    if (cached) return cached;
    return { status: 'not_connected', message: 'Conéctate una vez para preparar Billqo para uso offline.' };
  }

  try {
    const connection = await apiRequest<GoogleConnection>('/connection');
    return cacheConnection(connection, uid);
  } catch (error) {
    if (isNetworkError(error) && cached) return cached;
    throw error;
  }
}

export async function startGoogleAuthorization(): Promise<{ authorizationUrl: string }> {
  if (!browserIsOnline()) throw new FinancialApiError('Necesitas internet para conectar Google.', 0, 'NETWORK_ERROR');
  return apiRequest<{ authorizationUrl: string }>('/google/oauth/start', { method: 'POST' });
}

export async function ensureFinancialStorage(): Promise<GoogleConnection> {
  const uid = currentUid();
  const cached = await getOfflineValue<GoogleConnection>(uid, CONNECTION_KEY);
  if (!browserIsOnline()) {
    if (cached?.status === 'connected') return cached;
    throw new FinancialApiError('Necesitas internet para preparar tu Google Sheet por primera vez.', 0, 'NETWORK_ERROR');
  }
  try {
    const connection = await apiRequest<GoogleConnection>('/storage/ensure', { method: 'POST' });
    return cacheConnection(connection, uid);
  } catch (error) {
    if (isNetworkError(error) && cached?.status === 'connected') return cached;
    throw error;
  }
}

export async function getFinancialSnapshot(): Promise<FinancialSnapshot> {
  const uid = currentUid();
  if (!browserIsOnline()) return requireCachedSnapshot(uid);
  try {
    await flushFinancialOfflineQueue();
    return cacheSnapshot(await apiRequest<FinancialSnapshot>('/finance'), uid);
  } catch (error) {
    if (isNetworkError(error)) return requireCachedSnapshot(uid);
    throw error;
  }
}

export async function syncFinancialSnapshot(): Promise<FinancialSnapshot> {
  const uid = currentUid();
  if (!browserIsOnline()) return requireCachedSnapshot(uid);
  try {
    await flushFinancialOfflineQueue();
    return cacheSnapshot(await apiRequest<FinancialSnapshot>('/sync', jsonBody({})), uid);
  } catch (error) {
    if (isNetworkError(error)) return requireCachedSnapshot(uid);
    throw error;
  }
}

export async function getInsights(): Promise<AiInsightsResponse> {
  const uid = currentUid();
  const local = await cachedSnapshot(uid);
  if (!browserIsOnline()) {
    if (!local) return requireCachedSnapshot(uid).then((snapshot) => buildDeterministicInsights(snapshot.analytics, snapshot.transactions));
    return buildDeterministicInsights(local.analytics, local.transactions);
  }
  try {
    return await apiRequest<AiInsightsResponse>('/financial-insights', jsonBody({}));
  } catch (error) {
    if (isNetworkError(error) && local) return buildDeterministicInsights(local.analytics, local.transactions);
    throw error;
  }
}

export const scanReceipt = async (
  image: Blob,
  preferredType: TransactionType,
  categoryNames: string[],
): Promise<ReceiptScanResult> => {
  if (!browserIsOnline()) {
    throw new FinancialApiError('La lectura de comprobantes necesita internet. Puedes registrar el movimiento manualmente.', 0, 'NETWORK_ERROR');
  }
  return apiRequest<ReceiptScanResult>('/receipts/scan', {
    method: 'POST',
    headers: {
      'Content-Type': image.type || 'application/octet-stream',
      'X-Billqo-Preferred-Type': preferredType,
      'X-Billqo-Categories': encodeURIComponent(JSON.stringify([...new Set(categoryNames)].slice(0, 50))),
    },
    body: image,
  });
};

export async function createTransaction(transaction: TransactionPayload, idempotencyKey: string): Promise<Transaction> {
  const uid = currentUid();
  const localId = `offline:${idempotencyKey}`;
  if (browserIsOnline()) {
    try {
      const result = await apiRequest<Transaction>('/transactions', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(transaction),
      });
      await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, transactions: [...snapshot.transactions, result] }));
      return result;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  const result = transactionFromPayload(transaction, localId);
  await mutateOfflineQueue(uid, 'finance', (queue) => [
    ...queue.filter((item) => !(item.action === 'createTransaction' && (item.payload as any).localId === localId)),
    offlineOperation('finance', 'createTransaction', { transaction, idempotencyKey, localId }),
  ]);
  await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, transactions: [...snapshot.transactions, result] }));
  return result;
}

export async function patchTransaction(
  id: string,
  expectedUpdatedAt: string,
  transaction: TransactionPayload,
): Promise<Transaction> {
  const uid = currentUid();
  if (browserIsOnline() && !id.startsWith('offline:')) {
    try {
      const result = await apiRequest<Transaction>(`/transactions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ expectedUpdatedAt, transaction }),
      });
      await updateCachedSnapshot(uid, (snapshot) => ({
        ...snapshot,
        transactions: snapshot.transactions.map((item) => item.id === id ? result : item),
      }));
      return result;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  let queuedExpected = expectedUpdatedAt;
  await mutateOfflineQueue(uid, 'finance', (queue) => {
    if (id.startsWith('offline:')) {
      return queue.map((item) => {
        if (item.action !== 'createTransaction') return item;
        const payload = item.payload as any;
        if (payload.localId !== id) return item;
        return { ...item, payload: { ...payload, transaction } };
      });
    }
    const existing = queue.find((item) => item.action === 'patchTransaction' && (item.payload as any).id === id);
    if (existing) queuedExpected = String((existing.payload as any).expectedUpdatedAt || expectedUpdatedAt);
    return [
      ...queue.filter((item) => !(item.action === 'patchTransaction' && (item.payload as any).id === id)),
      offlineOperation('finance', 'patchTransaction', { id, expectedUpdatedAt: queuedExpected, transaction }),
    ];
  });

  let optimistic: Transaction | undefined;
  await updateCachedSnapshot(uid, (snapshot) => ({
    ...snapshot,
    transactions: snapshot.transactions.map((item) => {
      if (item.id !== id) return item;
      optimistic = transactionFromPayload(transaction, id, item);
      return optimistic;
    }),
  }));
  if (optimistic) return optimistic;
  return transactionFromPayload(transaction, id);
}

export async function deleteTransaction(id: string, expectedUpdatedAt: string): Promise<void> {
  const uid = currentUid();
  if (browserIsOnline() && !id.startsWith('offline:')) {
    try {
      await apiRequest<void>(`/transactions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        body: JSON.stringify({ expectedUpdatedAt }),
      });
      await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, transactions: snapshot.transactions.filter((item) => item.id !== id) }));
      return;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  await mutateOfflineQueue(uid, 'finance', (queue) => {
    if (id.startsWith('offline:')) {
      return queue.filter((item) => {
        const payload = item.payload as any;
        return !((item.action === 'createTransaction' && payload.localId === id) || payload.id === id);
      });
    }
    const priorPatch = queue.find((item) => item.action === 'patchTransaction' && (item.payload as any).id === id);
    const originalExpected = priorPatch ? String((priorPatch.payload as any).expectedUpdatedAt || expectedUpdatedAt) : expectedUpdatedAt;
    return [
      ...queue.filter((item) => !(['patchTransaction', 'deleteTransaction'].includes(item.action) && (item.payload as any).id === id)),
      offlineOperation('finance', 'deleteTransaction', { id, expectedUpdatedAt: originalExpected }),
    ];
  });
  await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, transactions: snapshot.transactions.filter((item) => item.id !== id) }));
}

export async function deleteAllTransactions(): Promise<void> {
  const uid = currentUid();
  if (browserIsOnline()) {
    try {
      await apiRequest<void>('/transactions', { method: 'DELETE' });
      await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, transactions: [] }));
      return;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await mutateOfflineQueue(uid, 'finance', (queue) => [
    ...queue.filter((item) => !['createTransaction', 'patchTransaction', 'deleteTransaction', 'deleteAllTransactions'].includes(item.action)),
    offlineOperation('finance', 'deleteAllTransactions', {}),
  ]);
  await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, transactions: [] }));
}

export async function deleteFinancialData(): Promise<void> {
  const uid = currentUid();
  if (browserIsOnline()) {
    try {
      await apiRequest<void>('/financial-data', { method: 'DELETE' });
      await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, transactions: [], budgets: [], recurrences: [] }));
      return;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await setOfflineQueue(uid, 'finance', [offlineOperation('finance', 'deleteFinancialData', {})]);
  await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, transactions: [], budgets: [], recurrences: [] }));
}

export async function saveBudget(
  id: string,
  input: Pick<CategoryBudget, 'categoryId'> & { amount: number; period: string; startDate: string; endDate: string; active: boolean },
  expectedUpdatedAt?: string,
): Promise<CategoryBudget> {
  const uid = currentUid();
  if (browserIsOnline()) {
    try {
      const result = await apiRequest<CategoryBudget>(`/budgets/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({ ...input, ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}) }),
      });
      await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, budgets: [...snapshot.budgets.filter((item) => item.id !== id), result] }));
      return result;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  let originalExpected = expectedUpdatedAt;
  await mutateOfflineQueue(uid, 'finance', (queue) => {
    const existing = queue.find((item) => item.action === 'saveBudget' && (item.payload as any).id === id);
    if (existing) originalExpected = (existing.payload as any).expectedUpdatedAt || originalExpected;
    return [
      ...queue.filter((item) => !(item.action === 'saveBudget' && (item.payload as any).id === id)),
      offlineOperation('finance', 'saveBudget', { id, input, expectedUpdatedAt: originalExpected }),
    ];
  });

  const snapshot = await requireCachedSnapshot(uid);
  const previous = snapshot.budgets.find((item) => item.id === id);
  const category = snapshot.categories.find((item) => item.id === input.categoryId);
  const now = new Date().toISOString();
  const result: CategoryBudget = {
    id,
    categoryId: input.categoryId,
    category: category?.name ?? previous?.category ?? '',
    allocatedAmount: input.amount,
    spentAmount: previous?.spentAmount ?? 0,
    period: input.period,
    startDate: input.startDate,
    endDate: input.endDate,
    active: input.active,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  await updateCachedSnapshot(uid, (current) => ({ ...current, budgets: [...current.budgets.filter((item) => item.id !== id), result] }));
  return result;
}

export async function savePreferences(
  preferences: Partial<Pick<FinancialPreferences, 'currency' | 'dateFormat' | 'timezone' | 'monthlyBudget'>>,
  expectedUpdatedAt: string,
): Promise<FinancialPreferences> {
  const uid = currentUid();
  if (browserIsOnline()) {
    try {
      const result = await apiRequest<FinancialPreferences>('/preferences', {
        method: 'PUT',
        body: JSON.stringify({ ...preferences, expectedUpdatedAt }),
      });
      await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, preferences: result }));
      return result;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  let originalExpected = expectedUpdatedAt;
  let merged = preferences;
  await mutateOfflineQueue(uid, 'finance', (queue) => {
    const existing = queue.find((item) => item.action === 'savePreferences');
    if (existing) {
      const payload = existing.payload as any;
      originalExpected = String(payload.expectedUpdatedAt || expectedUpdatedAt);
      merged = { ...payload.preferences, ...preferences };
    }
    return [
      ...queue.filter((item) => item.action !== 'savePreferences'),
      offlineOperation('finance', 'savePreferences', { preferences: merged, expectedUpdatedAt: originalExpected }),
    ];
  });

  const snapshot = await requireCachedSnapshot(uid);
  const result: FinancialPreferences = {
    ...snapshot.preferences,
    ...merged,
    updatedAt: new Date().toISOString(),
  };
  await updateCachedSnapshot(uid, (current) => ({ ...current, preferences: result }));
  return result;
}

export async function disconnectGoogle(): Promise<{ status: 'not_connected' }> {
  const uid = currentUid();
  if (browserIsOnline()) {
    try {
      const result = await apiRequest<{ status: 'not_connected' }>('/google/disconnect', { method: 'POST' });
      await cacheConnection({ status: 'not_connected' }, uid);
      return result;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await mutateOfflineQueue(uid, 'finance', (queue) => [
    ...queue.filter((item) => item.action !== 'disconnectGoogle'),
    offlineOperation('finance', 'disconnectGoogle', {}),
  ]);
  await cacheConnection({ status: 'not_connected' }, uid);
  return { status: 'not_connected' };
}

export function financialStorageDescription(): string {
  return 'Google Sheets — Billqo - Mis Finanzas';
}
