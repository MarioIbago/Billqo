import express, { Router } from 'express';
import { z, ZodError } from 'zod';
import type { BillingTicketInput } from '../src/billingTypes';
import { authenticated } from './auth';
import {
  createBillingTicket,
  createCfdiRecord,
  loadBillingSnapshot,
  saveFiscalProfile,
  updateBillingTicketStatus,
  uploadBillingFile,
} from './billingSheets';
import { scanBillingTicketImage } from './billingScanner';
import { parseCfdi40Xml } from './cfdi';
import { AppError, errors } from './errors';
import { assertReceiptImage } from './receiptScanner';

const router = Router();

const identifierSchema = z.object({
  key: z.string().trim().min(1).max(50),
  value: z.string().trim().min(1).max(180),
}).strict();

const fileRefSchema = z.object({
  fileId: z.string().trim().min(3).max(220),
  webViewUrl: z.string().trim().url().max(1_000).optional(),
  name: z.string().trim().max(180).optional(),
  mimeType: z.string().trim().max(100).optional(),
}).strict();

const ticketSchema = z.object({
  merchant: z.string().trim().min(1, 'Ingresa el comercio.').max(160),
  issuerRfc: z.string().trim().toUpperCase().max(13).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa fecha YYYY-MM-DD.'),
  time: z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/).optional(),
  total: z.coerce.number().finite().nonnegative(),
  subtotal: z.coerce.number().finite().nonnegative().optional(),
  iva: z.coerce.number().finite().nonnegative().optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).default('MXN'),
  paymentMethod: z.string().trim().max(80).optional(),
  cardLast4: z.string().regex(/^\d{4}$/).optional(),
  identifiers: z.array(identifierSchema).max(20).default([]),
  invoiceUrl: z.string().trim().url().max(500).optional(),
  qrData: z.string().trim().max(2_000).optional(),
  image: fileRefSchema.optional(),
  status: z.enum(['pending', 'invoiced', 'not_required']).default('pending'),
  notes: z.string().trim().max(1_000).optional(),
}).strict();

const fiscalProfileSchema = z.object({
  rfc: z.string().trim().toUpperCase().regex(/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/, 'Ingresa un RFC válido de 12 o 13 caracteres.'),
  legalName: z.string().trim().min(1).max(250),
  postalCode: z.string().regex(/^\d{5}$/, 'El código postal fiscal debe tener 5 dígitos.'),
  taxRegime: z.string().trim().regex(/^\d{3}$/, 'Usa la clave SAT de régimen fiscal de 3 dígitos.'),
  cfdiUse: z.string().trim().regex(/^[A-Z0-9]{3,4}$/, 'Usa la clave SAT de Uso CFDI.'),
  email: z.union([z.string().trim().email().max(320), z.literal('')]).optional(),
}).strict();

const ticketStatusSchema = z.object({
  status: z.enum(['pending', 'invoiced', 'not_required']),
  cfdiUuid: z.string().trim().uuid().optional(),
}).strict();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) throw errors.validation(error.issues[0]?.message ?? 'Los datos enviados no son válidos.');
    throw error;
  }
}

function safeFilename(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    return decodeURIComponent(value).slice(0, 180) || fallback;
  } catch {
    return fallback;
  }
}

router.post('/scan', express.raw({ type: () => true, limit: '6mb' }), async (req, res, next) => {
  try {
    authenticated(req);
    if (!Buffer.isBuffer(req.body)) throw errors.validation('No recibimos una imagen válida.');
    const mimeType = assertReceiptImage(req.body, req.header('Content-Type'));
    const result = await scanBillingTicketImage(req.body, mimeType);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/files/ticket-image', express.raw({ type: () => true, limit: '6mb' }), async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    if (!Buffer.isBuffer(req.body)) throw errors.validation('No recibimos una imagen válida.');
    const mimeType = assertReceiptImage(req.body, req.header('Content-Type'));
    const file = await uploadBillingFile(uid, {
      bytes: req.body,
      mimeType,
      originalName: safeFilename(req.header('X-Billqo-Filename'), 'ticket.jpg'),
      kind: 'ticket_image',
    });
    res.status(201).json({ data: file });
  } catch (error) {
    next(error);
  }
});

router.post('/cfdi/import', express.raw({ type: () => true, limit: '5mb' }), async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    if (!Buffer.isBuffer(req.body)) throw errors.validation('No recibimos un XML válido.');
    const parsed = parseCfdi40Xml(req.body);
    const current = await loadBillingSnapshot(uid);
    if (current.cfdis.some((item) => item.uuid === parsed.uuid)) throw errors.conflict('Este CFDI ya está registrado en Billqo.');
    const ticketId = req.header('X-Billqo-Ticket-Id')?.trim() || undefined;
    if (ticketId && !current.tickets.some((ticket) => ticket.id === ticketId)) throw errors.validation('El ticket seleccionado ya no existe.');
    const xml = await uploadBillingFile(uid, {
      bytes: req.body,
      mimeType: 'application/xml',
      originalName: safeFilename(req.header('X-Billqo-Filename'), `${parsed.uuid}.xml`),
      kind: 'cfdi_xml',
    });
    const record = await createCfdiRecord(uid, { ...parsed, ticketId, xml });
    res.status(201).json({ data: record });
  } catch (error) {
    next(error);
  }
});

router.use(express.json({ limit: '64kb' }));

router.get('/', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    res.status(200).json({ data: await loadBillingSnapshot(uid) });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    const profile = parse(fiscalProfileSchema, req.body);
    res.status(200).json({ data: await saveFiscalProfile(uid, { ...profile, email: profile.email || undefined }) });
  } catch (error) {
    next(error);
  }
});

router.post('/tickets', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    const input = parse(ticketSchema, req.body) as BillingTicketInput;
    res.status(201).json({ data: await createBillingTicket(uid, input) });
  } catch (error) {
    next(error);
  }
});

router.patch('/tickets/:id/status', async (req, res, next) => {
  try {
    const { uid } = authenticated(req);
    const id = z.string().trim().min(1).max(100).parse(req.params.id);
    const body = parse(ticketStatusSchema, req.body);
    if (body.status === 'invoiced' && !body.cfdiUuid) {
      const snapshot = await loadBillingSnapshot(uid);
      const existing = snapshot.tickets.find((ticket) => ticket.id === id);
      if (!existing?.cfdiUuid) throw errors.validation('Para marcarlo como facturado, importa el XML CFDI o captura su UUID.');
    }
    res.status(200).json({ data: await updateBillingTicketStatus(uid, id, body.status, body.cfdiUuid) });
  } catch (error) {
    next(error instanceof ZodError ? errors.validation('El ticket indicado no es válido.') : error);
  }
});

export default router;
