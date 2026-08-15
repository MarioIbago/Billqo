import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import type {
  BillingFileRef,
  BillingIdentifier,
  BillingSnapshot,
  BillingTicket,
  BillingTicketInput,
  BillingTicketStatus,
  CfdiRecord,
  FiscalProfile,
} from '../src/billingTypes';
import { getConnection } from './connectionStore';
import { errors } from './errors';
import { getAuthorizedGoogleClient, type GoogleOAuthClient } from './googleAuth';

const SHEETS = {
  tickets: 'TICKETS',
  fiscal: 'DATOS_FISCALES',
  cfdi: 'CFDI',
} as const;

const TICKET_HEADERS = [
  'id', 'comercio', 'rfc_emisor', 'fecha', 'hora', 'total', 'subtotal', 'iva', 'moneda',
  'metodo_pago', 'tarjeta_ultimos4', 'identificadores_json', 'url_facturacion', 'qr_data',
  'imagen_file_id', 'imagen_url', 'estado', 'cfdi_uuid', 'notas', 'created_at', 'updated_at',
] as const;

const FISCAL_HEADERS = [
  'perfil_id', 'rfc', 'nombre_razon_social', 'codigo_postal', 'regimen_fiscal', 'uso_cfdi', 'email', 'updated_at',
] as const;

const CFDI_HEADERS = [
  'uuid', 'ticket_id', 'version', 'serie', 'folio', 'fecha_emision', 'moneda', 'subtotal', 'descuento', 'total',
  'forma_pago', 'metodo_pago', 'lugar_expedicion', 'emisor_rfc', 'emisor_nombre', 'emisor_regimen',
  'receptor_rfc', 'receptor_nombre', 'receptor_cp', 'receptor_regimen', 'uso_cfdi', 'impuestos_trasladados',
  'impuestos_retenidos', 'xml_file_id', 'xml_url', 'pdf_file_id', 'pdf_url', 'created_at',
] as const;

const BILLING_SHEET_DEFINITIONS = [
  { title: SHEETS.tickets, headers: TICKET_HEADERS },
  { title: SHEETS.fiscal, headers: FISCAL_HEADERS },
  { title: SHEETS.cfdi, headers: CFDI_HEADERS },
] as const;

type Cell = string | number | boolean | null | undefined;
type Row = Cell[];

function nowIso(): string {
  return new Date().toISOString();
}

function clean(value: Cell): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function number(value: Cell): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = clean(value).replace(/[$,\s]/g, '');
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function a1(sheet: string, range: string): string {
  return `'${sheet.replace(/'/g, "''")}'!${range}`;
}

export function columnLabel(columnNumber: number): string {
  if (!Number.isInteger(columnNumber) || columnNumber < 1) throw new Error('Column number must be a positive integer.');
  let value = columnNumber;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function getSheets(client: GoogleOAuthClient) {
  return google.sheets({ version: 'v4', auth: client as never });
}

function getDrive(client: GoogleOAuthClient) {
  return google.drive({ version: 'v3', auth: client as never });
}

async function storage(uid: string): Promise<{ client: GoogleOAuthClient; spreadsheetId: string }> {
  const connection = await getConnection(uid);
  if (!connection?.spreadsheetId) throw errors.sheetNotFound('Conecta tu Google Sheet antes de usar Facturación.');
  return { client: await getAuthorizedGoogleClient(uid), spreadsheetId: connection.spreadsheetId };
}

function sameHeader(values: Row[], expected: readonly string[]): boolean {
  const first = values[0] ?? [];
  return expected.every((header, index) => clean(first[index]) === header);
}

async function ensureHeader(client: GoogleOAuthClient, spreadsheetId: string, title: string, headers: readonly string[]): Promise<void> {
  const sheets = getSheets(client);
  const last = columnLabel(headers.length);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: a1(title, `A1:${last}2`),
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const values = (response.data.values ?? []) as Row[];
  if (values.length === 0 || (values[0] ?? []).every((cell) => clean(cell) === '')) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: a1(title, `A1:${last}1`),
      valueInputOption: 'RAW',
      requestBody: { values: [Array.from(headers)] },
    });
    return;
  }
  if (!sameHeader(values, headers)) {
    throw errors.schema(`La hoja ${title} existe pero su estructura no corresponde al módulo de Facturación de Billqo.`);
  }
}

async function ensureBillingStructure(client: GoogleOAuthClient, spreadsheetId: string): Promise<void> {
  const sheets = getSheets(client);
  const current = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title,gridProperties(columnCount))',
  });
  const existing = current.data.sheets?.map((sheet) => sheet.properties).filter(Boolean) ?? [];
  const requests: Array<Record<string, unknown>> = [];

  for (const definition of BILLING_SHEET_DEFINITIONS) {
    const property = existing.find((item) => item?.title === definition.title);
    const requiredColumns = Math.max(26, definition.headers.length);
    if (!property) {
      requests.push({ addSheet: { properties: { title: definition.title, gridProperties: { columnCount: requiredColumns } } } });
      continue;
    }
    if (property.sheetId !== undefined && (property.gridProperties?.columnCount ?? 0) < requiredColumns) {
      requests.push({
        updateSheetProperties: {
          properties: { sheetId: property.sheetId, gridProperties: { columnCount: requiredColumns } },
          fields: 'gridProperties.columnCount',
        },
      });
    }
  }

  if (requests.length > 0) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

  await ensureHeader(client, spreadsheetId, SHEETS.tickets, TICKET_HEADERS);
  await ensureHeader(client, spreadsheetId, SHEETS.fiscal, FISCAL_HEADERS);
  await ensureHeader(client, spreadsheetId, SHEETS.cfdi, CFDI_HEADERS);

  const refreshed = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' });
  const formatRequests: Array<Record<string, unknown>> = [];
  const managedTitles = new Set<string>(Object.values(SHEETS));
  for (const sheet of refreshed.data.sheets ?? []) {
    const properties = sheet.properties;
    if (properties?.sheetId === undefined || !managedTitles.has(properties.title ?? '')) continue;
    formatRequests.push(
      {
        updateSheetProperties: {
          properties: { sheetId: properties.sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      },
      {
        repeatCell: {
          range: { sheetId: properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.05, green: 0.30, blue: 0.23 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      },
    );
  }
  if (formatRequests.length > 0) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: formatRequests } });
}

function parseIdentifiers(value: Cell): BillingIdentifier[] {
  const raw = clean(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is { key: string; value: string } => Boolean(item && typeof item === 'object' && typeof (item as { key?: unknown }).key === 'string' && typeof (item as { value?: unknown }).value === 'string'))
      .map((item) => ({ key: item.key.trim(), value: item.value.trim() }))
      .filter((item) => item.key && item.value)
      .slice(0, 20);
  } catch {
    return [];
  }
}

function ticketFromRow(row: Row): BillingTicket | undefined {
  const id = clean(row[0]);
  const merchant = clean(row[1]);
  const date = clean(row[3]);
  const total = number(row[5]);
  const createdAt = clean(row[19]);
  const updatedAt = clean(row[20]);
  const status = clean(row[16]) as BillingTicketStatus;
  if (!id || !merchant || !date || total === undefined || !createdAt || !updatedAt || !['pending', 'invoiced', 'not_required'].includes(status)) return undefined;
  const imageId = clean(row[14]);
  return {
    id,
    merchant,
    issuerRfc: clean(row[2]) || undefined,
    date,
    time: clean(row[4]) || undefined,
    total,
    subtotal: number(row[6]),
    iva: number(row[7]),
    currency: clean(row[8]) || 'MXN',
    paymentMethod: clean(row[9]) || undefined,
    cardLast4: clean(row[10]) || undefined,
    identifiers: parseIdentifiers(row[11]),
    invoiceUrl: clean(row[12]) || undefined,
    qrData: clean(row[13]) || undefined,
    image: imageId ? { fileId: imageId, webViewUrl: clean(row[15]) || undefined } : undefined,
    status,
    cfdiUuid: clean(row[17]) || undefined,
    notes: clean(row[18]) || undefined,
    createdAt,
    updatedAt,
  };
}

function ticketRow(ticket: BillingTicket): Row {
  return [
    ticket.id, ticket.merchant, ticket.issuerRfc ?? '', ticket.date, ticket.time ?? '', ticket.total,
    ticket.subtotal ?? '', ticket.iva ?? '', ticket.currency, ticket.paymentMethod ?? '', ticket.cardLast4 ?? '',
    JSON.stringify(ticket.identifiers), ticket.invoiceUrl ?? '', ticket.qrData ?? '', ticket.image?.fileId ?? '',
    ticket.image?.webViewUrl ?? '', ticket.status, ticket.cfdiUuid ?? '', ticket.notes ?? '', ticket.createdAt, ticket.updatedAt,
  ];
}

function fiscalFromRow(row: Row): FiscalProfile | undefined {
  if (clean(row[0]) !== 'default') return undefined;
  const rfc = clean(row[1]);
  const legalName = clean(row[2]);
  const postalCode = clean(row[3]);
  const taxRegime = clean(row[4]);
  const cfdiUse = clean(row[5]);
  const updatedAt = clean(row[7]);
  if (!rfc || !legalName || !postalCode || !taxRegime || !cfdiUse || !updatedAt) return undefined;
  return { rfc, legalName, postalCode, taxRegime, cfdiUse, email: clean(row[6]) || undefined, updatedAt };
}

function cfdiFromRow(row: Row): CfdiRecord | undefined {
  const uuid = clean(row[0]);
  const issuedAt = clean(row[5]);
  const total = number(row[9]);
  const issuerRfc = clean(row[13]);
  const receiverRfc = clean(row[16]);
  const xmlFileId = clean(row[23]);
  const createdAt = clean(row[27]);
  if (!uuid || !issuedAt || total === undefined || !issuerRfc || !receiverRfc || !xmlFileId || !createdAt) return undefined;
  const pdfFileId = clean(row[25]);
  return {
    uuid,
    ticketId: clean(row[1]) || undefined,
    version: clean(row[2]) || '4.0',
    series: clean(row[3]) || undefined,
    folio: clean(row[4]) || undefined,
    issuedAt,
    currency: clean(row[6]) || undefined,
    subtotal: number(row[7]),
    discount: number(row[8]),
    total,
    paymentForm: clean(row[10]) || undefined,
    paymentMethod: clean(row[11]) || undefined,
    placeOfIssue: clean(row[12]) || undefined,
    issuerRfc,
    issuerName: clean(row[14]) || undefined,
    issuerTaxRegime: clean(row[15]) || undefined,
    receiverRfc,
    receiverName: clean(row[17]) || undefined,
    receiverPostalCode: clean(row[18]) || undefined,
    receiverTaxRegime: clean(row[19]) || undefined,
    cfdiUse: clean(row[20]) || undefined,
    transferredTaxes: number(row[21]),
    withheldTaxes: number(row[22]),
    xml: { fileId: xmlFileId, webViewUrl: clean(row[24]) || undefined, mimeType: 'application/xml' },
    pdf: pdfFileId ? { fileId: pdfFileId, webViewUrl: clean(row[26]) || undefined, mimeType: 'application/pdf' } : undefined,
    createdAt,
  };
}

function cfdiRow(record: CfdiRecord): Row {
  return [
    record.uuid, record.ticketId ?? '', record.version, record.series ?? '', record.folio ?? '', record.issuedAt,
    record.currency ?? '', record.subtotal ?? '', record.discount ?? '', record.total, record.paymentForm ?? '',
    record.paymentMethod ?? '', record.placeOfIssue ?? '', record.issuerRfc, record.issuerName ?? '', record.issuerTaxRegime ?? '',
    record.receiverRfc, record.receiverName ?? '', record.receiverPostalCode ?? '', record.receiverTaxRegime ?? '', record.cfdiUse ?? '',
    record.transferredTaxes ?? '', record.withheldTaxes ?? '', record.xml.fileId, record.xml.webViewUrl ?? '', record.pdf?.fileId ?? '',
    record.pdf?.webViewUrl ?? '', record.createdAt,
  ];
}

export async function loadBillingSnapshot(uid: string): Promise<BillingSnapshot> {
  const { client, spreadsheetId } = await storage(uid);
  await ensureBillingStructure(client, spreadsheetId);
  const sheets = getSheets(client);
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [a1(SHEETS.tickets, 'A1:U5000'), a1(SHEETS.fiscal, 'A1:H20'), a1(SHEETS.cfdi, 'A1:AB5000')],
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const ticketRows = (response.data.valueRanges?.[0]?.values ?? []) as Row[];
  const fiscalRows = (response.data.valueRanges?.[1]?.values ?? []) as Row[];
  const cfdiRows = (response.data.valueRanges?.[2]?.values ?? []) as Row[];
  const tickets = ticketRows.slice(1).map(ticketFromRow).filter((value): value is BillingTicket => Boolean(value)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const fiscalProfile = fiscalRows.slice(1).map(fiscalFromRow).find((value): value is FiscalProfile => Boolean(value));
  const cfdis = cfdiRows.slice(1).map(cfdiFromRow).filter((value): value is CfdiRecord => Boolean(value)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { tickets, fiscalProfile, cfdis, syncedAt: nowIso() };
}

export async function saveFiscalProfile(uid: string, profile: Omit<FiscalProfile, 'updatedAt'>): Promise<FiscalProfile> {
  const { client, spreadsheetId } = await storage(uid);
  await ensureBillingStructure(client, spreadsheetId);
  const updatedAt = nowIso();
  const value: FiscalProfile = { ...profile, rfc: profile.rfc.toUpperCase(), updatedAt };
  await getSheets(client).spreadsheets.values.update({
    spreadsheetId,
    range: a1(SHEETS.fiscal, 'A2:H2'),
    valueInputOption: 'RAW',
    requestBody: { values: [['default', value.rfc, value.legalName, value.postalCode, value.taxRegime, value.cfdiUse, value.email ?? '', value.updatedAt]] },
  });
  return value;
}

export async function createBillingTicket(uid: string, input: BillingTicketInput): Promise<BillingTicket> {
  const { client, spreadsheetId } = await storage(uid);
  await ensureBillingStructure(client, spreadsheetId);
  const timestamp = nowIso();
  const ticket: BillingTicket = {
    ...input,
    id: randomUUID(),
    issuerRfc: input.issuerRfc?.toUpperCase(),
    identifiers: input.identifiers.slice(0, 20),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await getSheets(client).spreadsheets.values.append({
    spreadsheetId,
    range: a1(SHEETS.tickets, 'A:U'),
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [ticketRow(ticket)] },
  });
  return ticket;
}

async function findTicketRow(client: GoogleOAuthClient, spreadsheetId: string, id: string): Promise<{ rowNumber: number; ticket: BillingTicket }> {
  const response = await getSheets(client).spreadsheets.values.get({
    spreadsheetId,
    range: a1(SHEETS.tickets, 'A1:U5000'),
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = (response.data.values ?? []) as Row[];
  for (let index = 1; index < rows.length; index += 1) {
    if (clean(rows[index]?.[0]) !== id) continue;
    const ticket = ticketFromRow(rows[index] ?? []);
    if (!ticket) throw errors.schema('El ticket existe pero sus datos no son válidos.');
    return { rowNumber: index + 1, ticket };
  }
  throw errors.validation('No encontramos el ticket indicado.');
}

export async function updateBillingTicketStatus(uid: string, id: string, status: BillingTicketStatus, cfdiUuid?: string): Promise<BillingTicket> {
  const { client, spreadsheetId } = await storage(uid);
  await ensureBillingStructure(client, spreadsheetId);
  const found = await findTicketRow(client, spreadsheetId, id);
  const ticket: BillingTicket = {
    ...found.ticket,
    status,
    cfdiUuid: cfdiUuid?.toUpperCase() || (status === 'invoiced' ? found.ticket.cfdiUuid : undefined),
    updatedAt: nowIso(),
  };
  await getSheets(client).spreadsheets.values.update({
    spreadsheetId,
    range: a1(SHEETS.tickets, `A${found.rowNumber}:U${found.rowNumber}`),
    valueInputOption: 'RAW',
    requestBody: { values: [ticketRow(ticket)] },
  });
  return ticket;
}

export async function createCfdiRecord(uid: string, record: Omit<CfdiRecord, 'createdAt'>): Promise<CfdiRecord> {
  const { client, spreadsheetId } = await storage(uid);
  await ensureBillingStructure(client, spreadsheetId);
  const sheets = getSheets(client);
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: a1(SHEETS.cfdi, 'A2:A5000'), valueRenderOption: 'UNFORMATTED_VALUE' });
  const duplicate = (existing.data.values ?? []).some((row) => clean((row as Row)[0]).toUpperCase() === record.uuid.toUpperCase());
  if (duplicate) throw errors.conflict('Este CFDI ya está registrado en Billqo.');
  const value: CfdiRecord = { ...record, uuid: record.uuid.toUpperCase(), createdAt: nowIso() };
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: a1(SHEETS.cfdi, 'A:AB'),
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [cfdiRow(value)] },
  });
  if (value.ticketId) await updateBillingTicketStatus(uid, value.ticketId, 'invoiced', value.uuid);
  return value;
}

async function billingFolder(client: GoogleOAuthClient): Promise<string> {
  const drive = getDrive(client);
  const found = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='billqoBillingFolder' and value='v1' }",
    spaces: 'drive',
    fields: 'files(id)',
    pageSize: 2,
  });
  const existing = found.data.files?.[0]?.id;
  if (existing) return existing;
  const created = await drive.files.create({
    requestBody: {
      name: 'Billqo - Comprobantes',
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { billqoBillingFolder: 'v1' },
    },
    fields: 'id',
  });
  if (!created.data.id) throw errors.google('No pudimos crear la carpeta de comprobantes en Google Drive.');
  return created.data.id;
}

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'archivo';
}

export async function uploadBillingFile(
  uid: string,
  input: { bytes: Buffer; mimeType: string; originalName: string; kind: 'ticket_image' | 'cfdi_xml' | 'cfdi_pdf' },
): Promise<BillingFileRef> {
  const { client } = await storage(uid);
  const drive = getDrive(client);
  const folderId = await billingFolder(client);
  const created = await drive.files.create({
    requestBody: {
      name: `${new Date().toISOString().slice(0, 10)} - ${safeFileName(input.originalName)}`,
      parents: [folderId],
      appProperties: { billqoFileKind: input.kind },
    },
    media: { mimeType: input.mimeType, body: Readable.from(input.bytes) },
    fields: 'id,name,mimeType,webViewLink',
  });
  const fileId = created.data.id;
  if (!fileId) throw errors.google('Google Drive no devolvió el identificador del archivo guardado.');
  return {
    fileId,
    name: created.data.name ?? undefined,
    mimeType: created.data.mimeType ?? input.mimeType,
    webViewUrl: created.data.webViewLink ?? undefined,
  };
}
