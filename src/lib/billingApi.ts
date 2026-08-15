import type {
  BillingFileRef,
  BillingSnapshot,
  BillingTicket,
  BillingTicketInput,
  BillingTicketScanResult,
  BillingTicketStatus,
  CfdiRecord,
  FiscalProfile,
} from '../billingTypes';
import { auth } from './firebase';
import { FinancialApiError } from './api';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '');

interface ApiEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string; recoverable?: boolean };
}

async function billingRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new FinancialApiError('Tu sesión terminó. Vuelve a iniciar sesión.', 401, 'AUTH_REQUIRED');
  const token = await currentUser.getIdToken().catch(() => undefined);
  if (!token) throw new FinancialApiError('No pudimos validar tu sesión.', 401, 'AUTH_REQUIRED');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/billing${path}`, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new FinancialApiError('No pudimos comunicarnos con el servidor de Billqo.', 0, 'NETWORK_ERROR');
  }

  let body: ApiEnvelope<T> = {};
  try {
    body = await response.json() as ApiEnvelope<T>;
  } catch {
    if (!response.ok) throw new FinancialApiError(`El servidor respondió con ${response.status}.`, response.status, 'INTERNAL');
  }

  if (!response.ok) {
    const knownCodes = new Set([
      'AUTH_REQUIRED', 'GOOGLE_REAUTH_REQUIRED', 'SHEET_NOT_FOUND', 'SHEET_SCHEMA_INVALID', 'VALIDATION_FAILED',
      'CONFLICT', 'RATE_LIMITED', 'CONFIGURATION_ERROR', 'GOOGLE_ERROR', 'AI_PROVIDER_ERROR', 'INTERNAL',
    ]);
    const code = typeof body.error?.code === 'string' && knownCodes.has(body.error.code)
      ? body.error.code as ConstructorParameters<typeof FinancialApiError>[2]
      : response.status === 401 ? 'AUTH_REQUIRED' : 'INTERNAL';
    throw new FinancialApiError(
      body.error?.message || 'No pudimos completar la operación.',
      response.status,
      code,
      body.error?.recoverable ?? response.status >= 500,
    );
  }

  return body.data as T;
}

export const getBillingSnapshot = (): Promise<BillingSnapshot> => billingRequest<BillingSnapshot>('/');

export const saveBillingFiscalProfile = (profile: Omit<FiscalProfile, 'updatedAt'>): Promise<FiscalProfile> =>
  billingRequest<FiscalProfile>('/profile', { method: 'PUT', body: JSON.stringify(profile) });

export const createBillingTicket = (ticket: BillingTicketInput): Promise<BillingTicket> =>
  billingRequest<BillingTicket>('/tickets', { method: 'POST', body: JSON.stringify(ticket) });

export const updateBillingTicketStatus = (
  id: string,
  status: BillingTicketStatus,
  cfdiUuid?: string,
): Promise<BillingTicket> => billingRequest<BillingTicket>(`/tickets/${encodeURIComponent(id)}/status`, {
  method: 'PATCH',
  body: JSON.stringify({ status, ...(cfdiUuid ? { cfdiUuid } : {}) }),
});

export const scanBillingTicket = (image: Blob): Promise<BillingTicketScanResult> => billingRequest<BillingTicketScanResult>('/scan', {
  method: 'POST',
  headers: { 'Content-Type': image.type || 'application/octet-stream' },
  body: image,
});

export const uploadBillingTicketImage = (image: Blob, filename: string): Promise<BillingFileRef> => billingRequest<BillingFileRef>('/files/ticket-image', {
  method: 'POST',
  headers: {
    'Content-Type': image.type || 'application/octet-stream',
    'X-Billqo-Filename': encodeURIComponent(filename || 'ticket.jpg'),
  },
  body: image,
});

export const importCfdiXml = (file: Blob, filename: string, ticketId?: string): Promise<CfdiRecord> => billingRequest<CfdiRecord>('/cfdi/import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/xml',
    'X-Billqo-Filename': encodeURIComponent(filename || 'cfdi.xml'),
    ...(ticketId ? { 'X-Billqo-Ticket-Id': ticketId } : {}),
  },
  body: file,
});
