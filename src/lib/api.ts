import { auth } from './firebase';
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
    // Do not log headers, tokens or response bodies. The URL and browser origin
    // are enough to diagnose a local-server mismatch during development.
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

/**
 * Public support intake is intentionally separate from authenticated finance
 * calls: it sends no Firebase token or cookies and the server validates,
 * rate-limits and writes the report through Firebase Admin.
 */
export async function submitPublicReport(report: PublicReportPayload): Promise<void> {
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
    // Error envelopes are optional for a public endpoint; use a safe message.
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

function jsonBody(value: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(value) };
}

export type TransactionPayload = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'recurringId'>;

export const getConnection = (): Promise<GoogleConnection> => apiRequest<GoogleConnection>('/connection');

export const startGoogleAuthorization = (): Promise<{ authorizationUrl: string }> =>
  apiRequest<{ authorizationUrl: string }>('/google/oauth/start', { method: 'POST' });

export const ensureFinancialStorage = (): Promise<GoogleConnection> =>
  apiRequest<GoogleConnection>('/storage/ensure', { method: 'POST' });

export const getFinancialSnapshot = (): Promise<FinancialSnapshot> => apiRequest<FinancialSnapshot>('/finance');

export const syncFinancialSnapshot = (): Promise<FinancialSnapshot> => apiRequest<FinancialSnapshot>('/sync', jsonBody({}));

export const getInsights = (): Promise<AiInsightsResponse> => apiRequest<AiInsightsResponse>('/financial-insights', jsonBody({}));

export const scanReceipt = (
  image: Blob,
  preferredType: TransactionType,
  categoryNames: string[],
): Promise<ReceiptScanResult> => apiRequest<ReceiptScanResult>('/receipts/scan', {
  method: 'POST',
  headers: {
    'Content-Type': image.type || 'application/octet-stream',
    'X-Billqo-Preferred-Type': preferredType,
    'X-Billqo-Categories': encodeURIComponent(JSON.stringify([...new Set(categoryNames)].slice(0, 50))),
  },
  body: image,
});

export const createTransaction = (transaction: TransactionPayload, idempotencyKey: string): Promise<Transaction> =>
  apiRequest<Transaction>('/transactions', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(transaction),
  });

export const patchTransaction = (
  id: string,
  expectedUpdatedAt: string,
  transaction: TransactionPayload,
): Promise<Transaction> => apiRequest<Transaction>(`/transactions/${encodeURIComponent(id)}`, {
  method: 'PATCH',
  body: JSON.stringify({ expectedUpdatedAt, transaction }),
});

export const deleteTransaction = (id: string, expectedUpdatedAt: string): Promise<void> =>
  apiRequest<void>(`/transactions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ expectedUpdatedAt }),
  });

export const deleteAllTransactions = (): Promise<void> => apiRequest<void>('/transactions', { method: 'DELETE' });

export const deleteFinancialData = (): Promise<void> => apiRequest<void>('/financial-data', { method: 'DELETE' });

export const saveBudget = (
  id: string,
  input: Pick<CategoryBudget, 'categoryId'> & { amount: number; period: string; startDate: string; endDate: string; active: boolean },
  expectedUpdatedAt?: string,
): Promise<CategoryBudget> => apiRequest<CategoryBudget>(`/budgets/${encodeURIComponent(id)}`, {
  method: 'PUT',
  body: JSON.stringify({ ...input, ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}) }),
});

export const savePreferences = (
  preferences: Partial<Pick<FinancialPreferences, 'currency' | 'dateFormat' | 'timezone' | 'monthlyBudget'>>,
  expectedUpdatedAt: string,
): Promise<FinancialPreferences> => apiRequest<FinancialPreferences>('/preferences', {
  method: 'PUT',
  body: JSON.stringify({ ...preferences, expectedUpdatedAt }),
});

export const disconnectGoogle = (): Promise<{ status: 'not_connected' }> =>
  apiRequest<{ status: 'not_connected' }>('/google/disconnect', { method: 'POST' });

export function financialStorageDescription(): string {
  return 'Google Sheets — Billqo - Mis Finanzas';
}
