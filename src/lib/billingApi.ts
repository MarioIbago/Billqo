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

const API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '');
const SNAPSHOT_KEY = 'billing:snapshot';
const SYNC_ERRORS_KEY = 'billing:sync-errors';

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

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new FinancialApiError('Tu sesión terminó. Vuelve a iniciar sesión.', 401, 'AUTH_REQUIRED');
  return uid;
}

function isNetworkError(error: unknown): boolean {
  return !browserIsOnline() || (error instanceof FinancialApiError && error.status === 0);
}

async function cachedSnapshot(uid = currentUid()): Promise<BillingSnapshot | undefined> {
  return getOfflineValue<BillingSnapshot>(uid, SNAPSHOT_KEY);
}

async function cacheSnapshot(snapshot: BillingSnapshot, uid = currentUid()): Promise<BillingSnapshot> {
  await setOfflineValue(uid, SNAPSHOT_KEY, snapshot);
  return snapshot;
}

async function requireCachedSnapshot(uid = currentUid()): Promise<BillingSnapshot> {
  const snapshot = await cachedSnapshot(uid);
  if (snapshot) return snapshot;
  throw new FinancialApiError('Abre Facturación una vez con internet para preparar esta sección para uso offline.', 0, 'NETWORK_ERROR');
}

async function updateCachedSnapshot(
  uid: string,
  update: (snapshot: BillingSnapshot) => BillingSnapshot,
): Promise<BillingSnapshot | undefined> {
  const current = await cachedSnapshot(uid);
  if (!current) return undefined;
  const next = update(current);
  await cacheSnapshot(next, uid);
  return next;
}

async function recordSyncError(uid: string, operation: OfflineOperation, error: unknown): Promise<void> {
  const current = (await getOfflineValue<Array<{ operation: OfflineOperation; message: string; at: string }>>(uid, SYNC_ERRORS_KEY)) ?? [];
  const message = error instanceof Error ? error.message : 'No pudimos sincronizar un cambio local.';
  await setOfflineValue(uid, SYNC_ERRORS_KEY, [...current.slice(-19), { operation, message, at: new Date().toISOString() }]);
}

function localId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `offline:${prefix}:${random}`;
}

function localTicket(input: BillingTicketInput, id: string): BillingTicket {
  const now = new Date().toISOString();
  return { ...input, id, createdAt: now, updatedAt: now };
}

function attribute(element: Element | null, ...names: string[]): string | undefined {
  if (!element) return undefined;
  for (const name of names) {
    const value = element.getAttribute(name);
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

function firstByLocalName(root: ParentNode, name: string): Element | null {
  const elements = root.querySelectorAll('*');
  for (const element of elements) {
    if (element.localName.toLocaleLowerCase('es-MX') === name.toLocaleLowerCase('es-MX')) return element;
  }
  return null;
}

async function provisionalCfdi(file: Blob, filename: string, ticketId?: string): Promise<CfdiRecord> {
  const text = await file.text();
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new FinancialApiError('El XML no es válido.', 400, 'VALIDATION_FAILED');

  const comprobante = xml.documentElement;
  const issuer = firstByLocalName(xml, 'Emisor');
  const receiver = firstByLocalName(xml, 'Receptor');
  const timbre = firstByLocalName(xml, 'TimbreFiscalDigital');
  const uuid = attribute(timbre, 'UUID', 'Uuid', 'uuid');
  const issuerRfc = attribute(issuer, 'Rfc', 'RFC', 'rfc');
  const receiverRfc = attribute(receiver, 'Rfc', 'RFC', 'rfc');
  const total = Number(attribute(comprobante, 'Total', 'total'));

  if (!uuid || !issuerRfc || !receiverRfc || !Number.isFinite(total)) {
    throw new FinancialApiError('El CFDI no contiene UUID, RFC o total válidos.', 400, 'VALIDATION_FAILED');
  }

  const optionalNumber = (value: string | undefined): number | undefined => {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const issuedAt = attribute(comprobante, 'Fecha', 'fecha') ?? new Date().toISOString();
  const version = attribute(comprobante, 'Version', 'version') ?? '4.0';

  return {
    uuid,
    ticketId,
    version,
    series: attribute(comprobante, 'Serie', 'serie'),
    folio: attribute(comprobante, 'Folio', 'folio'),
    issuedAt,
    currency: attribute(comprobante, 'Moneda', 'moneda'),
    subtotal: optionalNumber(attribute(comprobante, 'SubTotal', 'Subtotal', 'subTotal')),
    discount: optionalNumber(attribute(comprobante, 'Descuento', 'descuento')),
    total,
    paymentForm: attribute(comprobante, 'FormaPago', 'formaPago'),
    paymentMethod: attribute(comprobante, 'MetodoPago', 'metodoPago'),
    placeOfIssue: attribute(comprobante, 'LugarExpedicion', 'lugarExpedicion'),
    issuerRfc,
    issuerName: attribute(issuer, 'Nombre', 'nombre'),
    issuerTaxRegime: attribute(issuer, 'RegimenFiscal', 'regimenFiscal'),
    receiverRfc,
    receiverName: attribute(receiver, 'Nombre', 'nombre'),
    receiverPostalCode: attribute(receiver, 'DomicilioFiscalReceptor', 'domicilioFiscalReceptor'),
    receiverTaxRegime: attribute(receiver, 'RegimenFiscalReceptor', 'regimenFiscalReceptor'),
    cfdiUse: attribute(receiver, 'UsoCFDI', 'usoCFDI'),
    xml: { fileId: `offline:cfdi:${uuid}`, name: filename, mimeType: 'application/xml' },
    createdAt: new Date().toISOString(),
  };
}

let flushPromise: Promise<void> | undefined;

export async function flushBillingOfflineQueue(): Promise<void> {
  if (!browserIsOnline() || !auth.currentUser) return;
  if (flushPromise) return flushPromise;

  const uid = currentUid();
  flushPromise = (async () => {
    while (browserIsOnline()) {
      const queue = await getOfflineQueue(uid, 'billing');
      const operation = queue[0];
      if (!operation) return;

      try {
        const payload = operation.payload as Record<string, any>;
        if (operation.action === 'uploadImage') {
          const result = await billingRequest<BillingFileRef>('/files/ticket-image', {
            method: 'POST',
            headers: {
              'Content-Type': payload.image.type || 'application/octet-stream',
              'X-Billqo-Filename': encodeURIComponent(payload.filename || 'ticket.jpg'),
            },
            body: payload.image as Blob,
          });
          const rewritten = queue.slice(1).map((item) => {
            if (item.action !== 'createTicket') return item;
            const nextPayload = item.payload as any;
            if (nextPayload.ticket?.image?.fileId !== payload.localFileId) return item;
            return { ...item, payload: { ...nextPayload, ticket: { ...nextPayload.ticket, image: result } } };
          });
          await setOfflineQueue(uid, 'billing', rewritten);
          await updateCachedSnapshot(uid, (snapshot) => ({
            ...snapshot,
            tickets: snapshot.tickets.map((ticket) => ticket.image?.fileId === payload.localFileId ? { ...ticket, image: result } : ticket),
          }));
          continue;
        }

        if (operation.action === 'createTicket') {
          const result = await billingRequest<BillingTicket>('/tickets', { method: 'POST', body: JSON.stringify(payload.ticket) });
          await updateCachedSnapshot(uid, (snapshot) => ({
            ...snapshot,
            tickets: snapshot.tickets.map((ticket) => ticket.id === payload.localId ? result : ticket),
          }));
        } else if (operation.action === 'saveProfile') {
          const result = await billingRequest<FiscalProfile>('/profile', { method: 'PUT', body: JSON.stringify(payload.profile) });
          await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, fiscalProfile: result }));
        } else if (operation.action === 'updateStatus') {
          const result = await billingRequest<BillingTicket>(`/tickets/${encodeURIComponent(String(payload.id))}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: payload.status, ...(payload.cfdiUuid ? { cfdiUuid: payload.cfdiUuid } : {}) }),
          });
          await updateCachedSnapshot(uid, (snapshot) => ({
            ...snapshot,
            tickets: snapshot.tickets.map((ticket) => ticket.id === result.id ? result : ticket),
          }));
        } else if (operation.action === 'importCfdi') {
          const result = await billingRequest<CfdiRecord>('/cfdi/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/xml',
              'X-Billqo-Filename': encodeURIComponent(payload.filename || 'cfdi.xml'),
              ...(payload.ticketId ? { 'X-Billqo-Ticket-Id': String(payload.ticketId) } : {}),
            },
            body: payload.file as Blob,
          });
          await updateCachedSnapshot(uid, (snapshot) => ({
            ...snapshot,
            cfdis: [...snapshot.cfdis.filter((cfdi) => cfdi.uuid !== payload.localUuid), result],
          }));
        }

        await setOfflineQueue(uid, 'billing', queue.slice(1));
      } catch (error) {
        if (isNetworkError(error) || (error instanceof FinancialApiError && (error.status === 401 || error.status >= 500))) return;
        await recordSyncError(uid, operation, error);
        await setOfflineQueue(uid, 'billing', queue.slice(1));
      }
    }
  })().finally(() => {
    flushPromise = undefined;
  });

  return flushPromise;
}

export async function getBillingSnapshot(): Promise<BillingSnapshot> {
  const uid = currentUid();
  if (!browserIsOnline()) return requireCachedSnapshot(uid);
  try {
    await flushBillingOfflineQueue();
    return cacheSnapshot(await billingRequest<BillingSnapshot>('/'), uid);
  } catch (error) {
    if (isNetworkError(error)) return requireCachedSnapshot(uid);
    throw error;
  }
}

export async function saveBillingFiscalProfile(profile: Omit<FiscalProfile, 'updatedAt'>): Promise<FiscalProfile> {
  const uid = currentUid();
  if (browserIsOnline()) {
    try {
      const result = await billingRequest<FiscalProfile>('/profile', { method: 'PUT', body: JSON.stringify(profile) });
      await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, fiscalProfile: result }));
      return result;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  const result: FiscalProfile = { ...profile, updatedAt: new Date().toISOString() };
  await mutateOfflineQueue(uid, 'billing', (queue) => [
    ...queue.filter((item) => item.action !== 'saveProfile'),
    offlineOperation('billing', 'saveProfile', { profile }),
  ]);
  await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, fiscalProfile: result }));
  return result;
}

export async function createBillingTicket(ticket: BillingTicketInput): Promise<BillingTicket> {
  const uid = currentUid();
  if (browserIsOnline() && !ticket.image?.fileId.startsWith('offline:')) {
    try {
      const result = await billingRequest<BillingTicket>('/tickets', { method: 'POST', body: JSON.stringify(ticket) });
      await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, tickets: [...snapshot.tickets, result] }));
      return result;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  const id = localId('ticket');
  const result = localTicket(ticket, id);
  await mutateOfflineQueue(uid, 'billing', (queue) => [...queue, offlineOperation('billing', 'createTicket', { ticket, localId: id })]);
  await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, tickets: [...snapshot.tickets, result] }));
  return result;
}

export async function updateBillingTicketStatus(
  id: string,
  status: BillingTicketStatus,
  cfdiUuid?: string,
): Promise<BillingTicket> {
  const uid = currentUid();
  if (browserIsOnline() && !id.startsWith('offline:')) {
    try {
      const result = await billingRequest<BillingTicket>(`/tickets/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(cfdiUuid ? { cfdiUuid } : {}) }),
      });
      await updateCachedSnapshot(uid, (snapshot) => ({
        ...snapshot,
        tickets: snapshot.tickets.map((ticket) => ticket.id === result.id ? result : ticket),
      }));
      return result;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  await mutateOfflineQueue(uid, 'billing', (queue) => {
    if (id.startsWith('offline:')) {
      return queue.map((item) => {
        if (item.action !== 'createTicket') return item;
        const payload = item.payload as any;
        if (payload.localId !== id) return item;
        return { ...item, payload: { ...payload, ticket: { ...payload.ticket, status } } };
      });
    }
    return [
      ...queue.filter((item) => !(item.action === 'updateStatus' && (item.payload as any).id === id)),
      offlineOperation('billing', 'updateStatus', { id, status, cfdiUuid }),
    ];
  });

  let result: BillingTicket | undefined;
  await updateCachedSnapshot(uid, (snapshot) => ({
    ...snapshot,
    tickets: snapshot.tickets.map((ticket) => {
      if (ticket.id !== id) return ticket;
      result = { ...ticket, status, ...(cfdiUuid ? { cfdiUuid } : {}), updatedAt: new Date().toISOString() };
      return result;
    }),
  }));
  if (!result) throw new FinancialApiError('El ticket ya no está disponible.', 404, 'VALIDATION_FAILED');
  return result;
}

export async function scanBillingTicket(image: Blob): Promise<BillingTicketScanResult> {
  if (!browserIsOnline()) {
    throw new FinancialApiError('La lectura de fotos necesita internet. Puedes capturar el ticket manualmente.', 0, 'NETWORK_ERROR');
  }
  return billingRequest<BillingTicketScanResult>('/scan', {
    method: 'POST',
    headers: { 'Content-Type': image.type || 'application/octet-stream' },
    body: image,
  });
}

export async function uploadBillingTicketImage(image: Blob, filename: string): Promise<BillingFileRef> {
  const uid = currentUid();
  if (browserIsOnline()) {
    try {
      return await billingRequest<BillingFileRef>('/files/ticket-image', {
        method: 'POST',
        headers: {
          'Content-Type': image.type || 'application/octet-stream',
          'X-Billqo-Filename': encodeURIComponent(filename || 'ticket.jpg'),
        },
        body: image,
      });
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  const fileId = localId('ticket-image');
  await mutateOfflineQueue(uid, 'billing', (queue) => [
    ...queue,
    offlineOperation('billing', 'uploadImage', { image, filename, localFileId: fileId }),
  ]);
  return { fileId, name: filename, mimeType: image.type || 'application/octet-stream' };
}

export async function importCfdiXml(file: Blob, filename: string, ticketId?: string): Promise<CfdiRecord> {
  const uid = currentUid();
  if (browserIsOnline() && !ticketId?.startsWith('offline:')) {
    try {
      const result = await billingRequest<CfdiRecord>('/cfdi/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'X-Billqo-Filename': encodeURIComponent(filename || 'cfdi.xml'),
          ...(ticketId ? { 'X-Billqo-Ticket-Id': ticketId } : {}),
        },
        body: file,
      });
      await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, cfdis: [...snapshot.cfdis.filter((cfdi) => cfdi.uuid !== result.uuid), result] }));
      return result;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  const result = await provisionalCfdi(file, filename, ticketId);
  await mutateOfflineQueue(uid, 'billing', (queue) => [
    ...queue.filter((item) => !(item.action === 'importCfdi' && (item.payload as any).localUuid === result.uuid)),
    offlineOperation('billing', 'importCfdi', { file, filename, ticketId, localUuid: result.uuid }),
  ]);
  await updateCachedSnapshot(uid, (snapshot) => ({ ...snapshot, cfdis: [...snapshot.cfdis.filter((cfdi) => cfdi.uuid !== result.uuid), result] }));
  return result;
}
