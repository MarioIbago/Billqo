import { randomUUID } from 'node:crypto';
import { google } from 'googleapis';
import {
  calculateAnalytics,
} from '../src/analytics';
import type {
  Category,
  CategoryBudget,
  FinancialPreferences,
  FinancialSnapshot,
  FixedVariable,
  Necessity,
  PaymentMethod,
  RecurringTransaction,
  Transaction,
  TransactionType,
  ValidationIssue,
} from '../src/types';
import { getFinancialSheetTitle, getOwnerKey } from './config';
import {
  acquireProvisionLease,
  getConnection,
  markConnected,
  markConnectionStatus,
  releaseProvisionLease,
  touchLastSync,
} from './connectionStore';
import { AppError, errors } from './errors';
import { getAuthorizedGoogleClient, isReauthorizationError, markGoogleReauthorizationRequired } from './googleAuth';
import type { GoogleOAuthClient } from './googleAuth';
import {
  BUDGET_HEADERS,
  CATEGORY_HEADERS,
  CONFIGURATION_HEADERS,
  INITIAL_CONFIGURATION,
  MOVEMENT_HEADERS,
  RECURRENCE_HEADERS,
  SHEET_NAMES,
  SHEET_SCHEMA_VERSION,
  a1,
  initialCategoryRows,
} from './sheetsSchema';

type CellValue = string | number | boolean | null | undefined;
type SheetRow = CellValue[];

export interface TransactionWriteInput {
  amount: number;
  type: TransactionType;
  description: string;
  categoryId?: string;
  category: string;
  costType: Transaction['costType'];
  fixedVariable?: FixedVariable;
  necessity?: Necessity;
  influence?: 1 | 2 | 3 | 4 | 5;
  date: string;
  paymentMethod: PaymentMethod;
  account?: string;
  notes?: string;
  tags?: string[];
  recurring?: boolean;
}

export interface BudgetWriteInput {
  id?: string;
  expectedUpdatedAt?: string;
  categoryId: string;
  amount: number;
  period: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

const PAYMENT_METHODS: PaymentMethod[] = ['Efectivo', 'Tarjeta Débito', 'Tarjeta Crédito', 'Transferencia'];
const EXPENSE_COST_TYPES = new Set<Transaction['costType']>(['Fijo', 'Variable', 'Discrecional', 'Operativo', 'Hormiga']);

function clean(value: CellValue): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function parseBoolean(value: CellValue): boolean | undefined {
  if (value === true || clean(value).toLowerCase() === 'true' || clean(value).toLowerCase() === 'sí' || clean(value).toLowerCase() === 'si') return true;
  if (value === false || clean(value).toLowerCase() === 'false' || clean(value).toLowerCase() === 'no') return false;
  return undefined;
}

function parseNumber(value: CellValue): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalised = clean(value).replace(/[$,\s]/g, '');
  if (!normalised) return undefined;
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isUtcTimestamp(value: string): boolean {
  if (!value || !/(Z|[+-]00:00)$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function nowIso(): string {
  return new Date().toISOString();
}

function columnLabel(columnNumber: number): string {
  let value = columnNumber;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function asType(value: string): TransactionType | undefined {
  if (value.toLowerCase() === 'income' || value.toLowerCase() === 'ingreso') return 'income';
  if (value.toLowerCase() === 'expense' || value.toLowerCase() === 'gasto') return 'expense';
  return undefined;
}

function asCostType(value: string): Transaction['costType'] | undefined {
  return ['Fijo', 'Variable', 'Discrecional', 'Operativo', 'Hormiga', 'Ingreso'].includes(value)
    ? value as Transaction['costType']
    : undefined;
}

function columnIndex(headers: readonly string[], column: string): number {
  const index = headers.indexOf(column);
  if (index < 0) throw errors.schema(`Falta la columna obligatoria “${column}” en MOVIMIENTOS.`);
  return index;
}

function makeHeaderIndex(row: SheetRow, expected: readonly string[], sheet: string): Map<string, number> {
  const index = new Map(row.map((value, position) => [clean(value), position]));
  const missing = expected.filter((header) => !index.has(header));
  if (missing.length > 0) {
    throw errors.schema(`La hoja ${sheet} no tiene las columnas requeridas: ${missing.join(', ')}.`);
  }
  return index;
}

function at(row: SheetRow, index: Map<string, number>, key: string): CellValue {
  return row[index.get(key) ?? -1];
}

function makeMovementRow(transaction: Transaction): SheetRow {
  return [
    transaction.id,
    transaction.date,
    transaction.type === 'income' ? 'Ingreso' : 'Gasto',
    transaction.amount,
    transaction.description,
    transaction.categoryId ?? '',
    transaction.category,
    transaction.paymentMethod,
    transaction.account ?? '',
    transaction.costType,
    transaction.fixedVariable ?? '',
    transaction.necessity ?? '',
    transaction.influence ?? '',
    transaction.notes ?? '',
    transaction.tags?.join(', ') ?? '',
    transaction.recurringId ?? '',
    transaction.createdAt,
    transaction.updatedAt,
    transaction.deletedAt ?? '',
  ];
}

/**
 * A recurrence belongs to the idempotent movement operation. Deriving its ID
 * from the movement ID lets a retry find a recurrence that was written before
 * the movement write completed.
 */
export function recurrenceIdForTransaction(transactionId: string): string {
  return `recurrence-${transactionId}`;
}

function buildTransaction(input: TransactionWriteInput, id: string = randomUUID(), createdAt = nowIso(), updatedAt = createdAt, recurringId?: string): Transaction {
  const typeCost = input.type === 'income' ? 'Ingreso' : input.costType;
  return {
    id,
    amount: input.amount,
    type: input.type,
    description: input.description.trim(),
    categoryId: input.categoryId,
    category: input.category.trim(),
    costType: typeCost,
    fixedVariable: input.type === 'expense' ? input.fixedVariable : undefined,
    necessity: input.type === 'expense' ? input.necessity : undefined,
    influence: input.type === 'expense' ? input.influence : undefined,
    date: input.date,
    paymentMethod: input.paymentMethod,
    account: input.account?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    tags: input.tags?.map((tag) => tag.trim()).filter(Boolean),
    recurring: Boolean(recurringId),
    recurringId,
    createdAt,
    updatedAt,
  };
}

export function parseTransactionRows(values: SheetRow[], categories: Category[]): { transactions: Transaction[]; issues: ValidationIssue[]; rowsById: Map<string, number>; headers: Map<string, number> } {
  if (values.length === 0) throw errors.schema('La hoja MOVIMIENTOS está vacía o no tiene encabezados.');
  const headers = makeHeaderIndex(values[0] ?? [], MOVEMENT_HEADERS, SHEET_NAMES.transactions);
  const issues: ValidationIssue[] = [];
  const candidates: Array<{ transaction: Transaction; row: number }> = [];
  const categoryIds = new Set(categories.map((category) => category.id));

  for (let position = 1; position < values.length; position += 1) {
    const row = values[position] ?? [];
    const rowNumber = position + 1;
    if (row.every((value) => clean(value) === '')) continue;

    const id = clean(at(row, headers, 'id'));
    const date = clean(at(row, headers, 'fecha'));
    const type = asType(clean(at(row, headers, 'tipo')));
    const amount = parseNumber(at(row, headers, 'monto'));
    const description = clean(at(row, headers, 'descripcion'));
    const categoryId = clean(at(row, headers, 'categoria_id')) || undefined;
    const category = clean(at(row, headers, 'categoria'));
    const paymentMethod = clean(at(row, headers, 'metodo_pago')) as PaymentMethod;
    const costType = asCostType(clean(at(row, headers, 'clasificacion_costo')));
    const fixedVariable = clean(at(row, headers, 'fijo_variable')) as FixedVariable | '';
    const necessity = clean(at(row, headers, 'necesario_innecesario')) as Necessity | '';
    const influenceNumber = parseNumber(at(row, headers, 'influencia'));
    const createdAt = clean(at(row, headers, 'created_at'));
    const updatedAt = clean(at(row, headers, 'updated_at'));
    const deletedAt = clean(at(row, headers, 'deleted_at')) || undefined;

    const report = (field: string, message: string) => issues.push({ sheet: SHEET_NAMES.transactions, row: rowNumber, field, message });
    if (!id) report('id', 'Falta el identificador estable del movimiento.');
    if (!isDate(date)) report('fecha', 'La fecha debe tener el formato YYYY-MM-DD.');
    if (!type) report('tipo', 'El tipo debe ser Ingreso o Gasto.');
    if (amount === undefined || amount <= 0) report('monto', 'El monto debe ser un número mayor que cero.');
    if (!description) report('descripcion', 'Falta la descripción.');
    if (!category) report('categoria', 'Falta la categoría.');
    if (categoryId && !categoryIds.has(categoryId)) report('categoria_id', 'La categoría no existe en CATEGORÍAS.');
    if (!PAYMENT_METHODS.includes(paymentMethod)) report('metodo_pago', 'El método de pago no es válido.');
    if (!costType) report('clasificacion_costo', 'La clasificación de costo no es válida.');
    if (!isUtcTimestamp(createdAt)) report('created_at', 'created_at debe ser un timestamp UTC válido.');
    if (!isUtcTimestamp(updatedAt)) report('updated_at', 'updated_at debe ser un timestamp UTC válido.');
    if (type === 'income' && costType !== 'Ingreso') report('clasificacion_costo', 'Un ingreso debe tener clasificación Ingreso.');
    if (type === 'expense') {
      if (!EXPENSE_COST_TYPES.has(costType ?? 'Ingreso')) report('clasificacion_costo', 'Un gasto necesita una clasificación de gasto.');
      if (fixedVariable !== 'Fijo' && fixedVariable !== 'Variable') report('fijo_variable', 'Selecciona Fijo o Variable.');
      if (necessity !== 'Necesario' && necessity !== 'Innecesario') report('necesario_innecesario', 'Selecciona Necesario o Innecesario.');
      if (!influenceNumber || !Number.isInteger(influenceNumber) || influenceNumber < 1 || influenceNumber > 5) {
        report('influencia', 'La influencia debe ser un número entero entre 1 y 5.');
      }
    }

    const rowHasIssue = issues.some((issue) => issue.row === rowNumber);
    if (rowHasIssue || !id || !type || amount === undefined || !costType) continue;
    candidates.push({
      row: rowNumber,
      transaction: {
        id,
        date,
        type,
        amount,
        description,
        categoryId,
        category,
        paymentMethod,
        account: clean(at(row, headers, 'cuenta')) || undefined,
        costType,
        fixedVariable: fixedVariable || undefined,
        necessity: necessity || undefined,
        influence: influenceNumber as Transaction['influence'],
        notes: clean(at(row, headers, 'notas')) || undefined,
        tags: clean(at(row, headers, 'tags')).split(',').map((tag) => tag.trim()).filter(Boolean),
        recurringId: clean(at(row, headers, 'recurrente_id')) || undefined,
        recurring: Boolean(clean(at(row, headers, 'recurrente_id'))),
        createdAt,
        updatedAt,
        deletedAt,
      },
    });
  }

  const duplicateIds = new Set<string>();
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.transaction.id)) duplicateIds.add(candidate.transaction.id);
    seen.add(candidate.transaction.id);
  }
  const rowsById = new Map<string, number>();
  const transactions = candidates
    .filter((candidate) => {
      if (!duplicateIds.has(candidate.transaction.id)) return true;
      issues.push({
        sheet: SHEET_NAMES.transactions,
        row: candidate.row,
        field: 'id',
        message: 'El ID está duplicado y fue excluido del análisis.',
      });
      return false;
    })
    .map((candidate) => {
      rowsById.set(candidate.transaction.id, candidate.row);
      return candidate.transaction;
    });

  return { transactions, issues, rowsById, headers };
}

function parseCategories(values: SheetRow[]): { categories: Category[]; issues: ValidationIssue[] } {
  if (values.length === 0) throw errors.schema('La hoja CATEGORÍAS está vacía o no tiene encabezados.');
  const headers = makeHeaderIndex(values[0] ?? [], CATEGORY_HEADERS, SHEET_NAMES.categories);
  const categories: Category[] = [];
  const issues: ValidationIssue[] = [];
  for (let position = 1; position < values.length; position += 1) {
    const row = values[position] ?? [];
    if (row.every((value) => clean(value) === '')) continue;
    const rowNumber = position + 1;
    const type = asType(clean(at(row, headers, 'tipo')));
    const id = clean(at(row, headers, 'id'));
    const name = clean(at(row, headers, 'nombre'));
    const active = parseBoolean(at(row, headers, 'activo'));
    const createdAt = clean(at(row, headers, 'created_at'));
    const updatedAt = clean(at(row, headers, 'updated_at'));
    if (!id || !name || !type || active === undefined || !isUtcTimestamp(createdAt) || !isUtcTimestamp(updatedAt)) {
      issues.push({ sheet: SHEET_NAMES.categories, row: rowNumber, message: 'La categoría tiene datos incompletos.' });
      continue;
    }
    categories.push({
      id,
      name,
      type,
      icon: clean(at(row, headers, 'icono')) || 'tag',
      active,
      createdAt,
      updatedAt,
    });
  }
  return { categories, issues };
}

function parseBudgets(values: SheetRow[], categories: Category[]): { budgets: CategoryBudget[]; issues: ValidationIssue[] } {
  if (values.length === 0) throw errors.schema('La hoja PRESUPUESTOS está vacía o no tiene encabezados.');
  const headers = makeHeaderIndex(values[0] ?? [], BUDGET_HEADERS, SHEET_NAMES.budgets);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const budgets: CategoryBudget[] = [];
  const issues: ValidationIssue[] = [];
  for (let position = 1; position < values.length; position += 1) {
    const row = values[position] ?? [];
    if (row.every((value) => clean(value) === '')) continue;
    const id = clean(at(row, headers, 'id'));
    const categoryId = clean(at(row, headers, 'categoria_id'));
    const amount = parseNumber(at(row, headers, 'monto_limite'));
    const category = byId.get(categoryId);
    if (!id || !categoryId || amount === undefined || !category) {
      issues.push({ sheet: SHEET_NAMES.budgets, row: position + 1, message: 'El presupuesto tiene datos incompletos o una categoría desconocida.' });
      continue;
    }
    budgets.push({
      id,
      categoryId,
      category: category.name,
      allocatedAmount: amount,
      spentAmount: 0,
      period: clean(at(row, headers, 'periodo')) || 'Mensual',
      startDate: clean(at(row, headers, 'fecha_inicio')) || undefined,
      endDate: clean(at(row, headers, 'fecha_fin')) || undefined,
      active: parseBoolean(at(row, headers, 'activo')) ?? true,
      createdAt: clean(at(row, headers, 'created_at')) || undefined,
      updatedAt: clean(at(row, headers, 'updated_at')) || undefined,
      deletedAt: clean(at(row, headers, 'deleted_at')) || undefined,
    });
  }
  return { budgets, issues };
}

function parseRecurrences(values: SheetRow[]): { recurrences: RecurringTransaction[]; issues: ValidationIssue[] } {
  if (values.length === 0) throw errors.schema('La hoja RECURRENTES está vacía o no tiene encabezados.');
  const headers = makeHeaderIndex(values[0] ?? [], RECURRENCE_HEADERS, SHEET_NAMES.recurrences);
  const recurrences: RecurringTransaction[] = [];
  const issues: ValidationIssue[] = [];
  for (let position = 1; position < values.length; position += 1) {
    const row = values[position] ?? [];
    if (row.every((value) => clean(value) === '')) continue;
    const id = clean(at(row, headers, 'id'));
    const type = asType(clean(at(row, headers, 'tipo')));
    const amount = parseNumber(at(row, headers, 'monto'));
    if (!id || !type || amount === undefined) {
      issues.push({ sheet: SHEET_NAMES.recurrences, row: position + 1, message: 'La recurrencia tiene datos incompletos.' });
      continue;
    }
    recurrences.push({
      id,
      type,
      description: clean(at(row, headers, 'descripcion')),
      categoryId: clean(at(row, headers, 'categoria_id')) || undefined,
      category: clean(at(row, headers, 'categoria')),
      amount,
      frequency: clean(at(row, headers, 'frecuencia')) || 'Mensual',
      nextDate: clean(at(row, headers, 'proxima_fecha')),
      active: parseBoolean(at(row, headers, 'activo')) ?? true,
      createdAt: clean(at(row, headers, 'created_at')) || nowIso(),
      updatedAt: clean(at(row, headers, 'updated_at')) || nowIso(),
      deletedAt: clean(at(row, headers, 'deleted_at')) || undefined,
    });
  }
  return { recurrences, issues };
}

function parsePreferences(values: SheetRow[]): FinancialPreferences {
  if (values.length === 0) throw errors.schema('La hoja CONFIGURACIÓN está vacía o no tiene encabezados.');
  const headers = makeHeaderIndex(values[0] ?? [], CONFIGURATION_HEADERS, SHEET_NAMES.configuration);
  const valueByKey = new Map<string, CellValue>();
  const updatedAtValues: string[] = [];
  for (let position = 1; position < values.length; position += 1) {
    const row = values[position] ?? [];
    const key = clean(at(row, headers, 'clave'));
    if (key) valueByKey.set(key, at(row, headers, 'valor'));
    const updatedAt = clean(at(row, headers, 'updated_at'));
    if (isUtcTimestamp(updatedAt)) updatedAtValues.push(updatedAt);
  }
  const schemaVersion = parseNumber(valueByKey.get('version_schema'));
  if (schemaVersion !== SHEET_SCHEMA_VERSION) {
    throw errors.schema('La versión de la estructura del archivo no es compatible.');
  }
  return {
    currency: clean(valueByKey.get('moneda')) || 'MXN',
    dateFormat: clean(valueByKey.get('formato_fecha')) || 'DD/MM/YYYY',
    timezone: clean(valueByKey.get('timezone')) || 'America/Mexico_City',
    monthlyBudget: parseNumber(valueByKey.get('presupuesto_mensual_total')) ?? 0,
    schemaVersion,
    updatedAt: updatedAtValues.sort().at(-1),
  };
}

function getSheets(client: GoogleOAuthClient) {
  // googleapis currently brings two compatible google-auth-library type copies.
  // The instance is the same runtime OAuth client; the narrow cast only bridges that declaration split.
  return google.sheets({ version: 'v4', auth: client as never });
}

function getDrive(client: GoogleOAuthClient) {
  return google.drive({ version: 'v3', auth: client as never });
}

export function categorySeedRange(categoryRowCount: number): string {
  if (!Number.isInteger(categoryRowCount) || categoryRowCount < 1) {
    throw new Error('The initial category catalogue must contain at least one row.');
  }
  return `A1:G${categoryRowCount + 1}`;
}

async function ensureSpreadsheetStructure(client: GoogleOAuthClient, spreadsheetId: string): Promise<void> {
  const sheets = getSheets(client);
  const current = await withGoogleReadRetry(() => sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title)',
  }));
  const existing = current.data.sheets?.map((sheet) => sheet.properties).filter((properties): properties is NonNullable<typeof properties> => Boolean(properties)) ?? [];
  const byTitle = new Map(existing.map((properties) => [properties.title ?? '', properties]));
  const requests: Array<Record<string, unknown>> = [];

  if (!byTitle.has(SHEET_NAMES.transactions)) {
    const defaultSheet = byTitle.get('Sheet1') ?? existing[0];
    if (defaultSheet?.sheetId !== undefined) {
      requests.push({ updateSheetProperties: { properties: { sheetId: defaultSheet.sheetId, title: SHEET_NAMES.transactions }, fields: 'title' } });
      byTitle.set(SHEET_NAMES.transactions, { ...defaultSheet, title: SHEET_NAMES.transactions });
    } else {
      requests.push({ addSheet: { properties: { title: SHEET_NAMES.transactions } } });
    }
  }
  for (const title of [SHEET_NAMES.categories, SHEET_NAMES.budgets, SHEET_NAMES.recurrences, SHEET_NAMES.configuration]) {
    if (!byTitle.has(title)) requests.push({ addSheet: { properties: { title } } });
  }
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }
}

async function initialiseSpreadsheet(client: GoogleOAuthClient, spreadsheetId: string): Promise<void> {
  await ensureSpreadsheetStructure(client, spreadsheetId);
  const sheets = getSheets(client);
  const configuration = await withGoogleReadRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range: a1(SHEET_NAMES.configuration, 'A1:C10'),
    valueRenderOption: 'UNFORMATTED_VALUE',
  }));
  const currentRows = (configuration.data.values ?? []) as SheetRow[];
  const isInitialised = currentRows.some((row) => clean(row[0]) === 'version_schema' && Number(row[1]) === SHEET_SCHEMA_VERSION);
  if (isInitialised) return;

  const now = nowIso();
  const categoryRows = initialCategoryRows(now);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: a1(SHEET_NAMES.transactions, 'A1:S1'), values: [Array.from(MOVEMENT_HEADERS)] },
        { range: a1(SHEET_NAMES.categories, categorySeedRange(categoryRows.length)), values: [Array.from(CATEGORY_HEADERS), ...categoryRows] },
        { range: a1(SHEET_NAMES.budgets, 'A1:J1'), values: [Array.from(BUDGET_HEADERS)] },
        { range: a1(SHEET_NAMES.recurrences, 'A1:L1'), values: [Array.from(RECURRENCE_HEADERS)] },
        { range: a1(SHEET_NAMES.configuration, 'A1:C6'), values: [Array.from(CONFIGURATION_HEADERS), ...INITIAL_CONFIGURATION.map(([key, value]) => [key, value, now])] },
      ],
    },
  });

  const refreshed = await withGoogleReadRetry(() => sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' }));
  const properties = refreshed.data.sheets?.map((sheet) => sheet.properties).filter((value): value is NonNullable<typeof value> => Boolean(value)) ?? [];
  const requests: Array<Record<string, unknown>> = [];
  for (const property of properties) {
    if (property.sheetId === undefined) continue;
    requests.push(
      {
        updateSheetProperties: {
          properties: { sheetId: property.sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      },
      {
        repeatCell: {
          range: { sheetId: property.sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { backgroundColor: { red: 0.05, green: 0.30, blue: 0.23 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } } },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      },
    );
  }
  const transactionSheet = properties.find((property) => property.title === SHEET_NAMES.transactions);
  if (transactionSheet?.sheetId !== undefined) {
    requests.push({
      setDataValidation: {
        range: { sheetId: transactionSheet.sheetId, startRowIndex: 1, startColumnIndex: 12, endColumnIndex: 13 },
        rule: {
          condition: { type: 'NUMBER_BETWEEN', values: [{ userEnteredValue: '1' }, { userEnteredValue: '5' }] },
          strict: true,
          showCustomUi: true,
        },
      },
    });
  }
  if (requests.length > 0) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}

async function findManagedSpreadsheet(client: GoogleOAuthClient, uid: string): Promise<string | undefined> {
  const drive = getDrive(client);
  const ownerKey = getOwnerKey(uid);
  const response = await withGoogleReadRetry(() => drive.files.list({
    q: `mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and appProperties has { key='financialOwner' and value='${ownerKey}' }`,
    spaces: 'drive',
    fields: 'files(id)',
    pageSize: 2,
  }));
  const files = response.data.files ?? [];
  if (files.length > 1) {
    throw errors.conflict('Encontramos más de un archivo financiero administrado por Billqo. Desconecta Google Sheets y vuelve a conectarlo para resolver la conexión.');
  }
  return files[0]?.id ?? undefined;
}

async function verifySpreadsheetAccessible(client: GoogleOAuthClient, spreadsheetId: string): Promise<void> {
  const drive = getDrive(client);
  const file = await withGoogleReadRetry(() => drive.files.get({ fileId: spreadsheetId, fields: 'id,trashed' }));
  if ((file.data as { trashed?: boolean }).trashed) throw errors.sheetNotFound('Tu archivo financiero está en la papelera de Google Drive.');
}

function googleHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  const value = candidate.response?.status ?? candidate.status ?? candidate.code;
  return typeof value === 'number' ? value : undefined;
}

function googleProviderReason(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as {
    response?: { data?: { error?: unknown } };
  };
  const providerError = candidate.response?.data?.error;
  if (typeof providerError === 'string') return providerError;
  if (!providerError || typeof providerError !== 'object') return undefined;
  const details = providerError as {
    errors?: Array<{ reason?: unknown }>;
    status?: unknown;
  };
  const reason = details.errors?.[0]?.reason ?? details.status;
  return typeof reason === 'string' ? reason : undefined;
}

// Reads can safely be repeated because they do not mutate a user's Sheet.
// Mutations intentionally stay outside this helper: retrying an append after a
// network failure could create a duplicate financial record.
const MAX_GOOGLE_READ_RETRIES = 2;
const GOOGLE_READ_INITIAL_BACKOFF_MS = 250;
const GOOGLE_READ_BACKOFF_MULTIPLIER = 2;
const TRANSIENT_GOOGLE_NETWORK_CODES = new Set([
  'EAI_AGAIN',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

export function isRetryableGoogleReadError(error: unknown): boolean {
  const status = googleHttpStatus(error);
  if (status === 429 || (status !== undefined && status >= 500 && status < 600)) return true;
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && TRANSIENT_GOOGLE_NETWORK_CODES.has(code);
}

function waitForGoogleReadRetry(attempt: number): Promise<void> {
  const delayMs = GOOGLE_READ_INITIAL_BACKOFF_MS * GOOGLE_READ_BACKOFF_MULTIPLIER ** attempt;
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function withGoogleReadRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableGoogleReadError(error) || attempt >= MAX_GOOGLE_READ_RETRIES) throw error;
      console.warn('[billqo:google] retrying transient read', {
        retry: attempt + 1,
        status: googleHttpStatus(error),
      });
      await waitForGoogleReadRetry(attempt);
    }
  }
}

async function recoverConnectionError(uid: string, error: unknown): Promise<never> {
  if (error instanceof AppError) throw error;
  if (isReauthorizationError(error)) {
    await markGoogleReauthorizationRequired(uid);
    throw errors.reauthorization();
  }
  const status = googleHttpStatus(error);
  const providerReason = googleProviderReason(error);
  if (status === 404) {
    await markConnectionStatus(uid, 'file_missing');
    throw errors.sheetNotFound('No encontramos tu archivo financiero. Puede haberse eliminado o movido a la papelera.');
  }
  if (status === 403) {
    if (providerReason === 'accessNotConfigured' || providerReason === 'SERVICE_DISABLED') {
      throw errors.configuration('Google Sheets o Google Drive no estan habilitados para Billqo. Revisa la configuracion del proyecto.');
    }
    throw errors.google('Google no permitio acceder a tu archivo financiero. Comprueba sus permisos y vuelve a conectar Google Sheets si los cambiaste.');
  }
  if (status === 400) {
    throw errors.google('Google no acepto la solicitud para tu archivo financiero. Comprueba la estructura del documento y vuelve a intentarlo.');
  }
  if (status === 429) {
    throw errors.google('Google Sheets esta ocupado temporalmente. Espera unos segundos y vuelve a intentarlo.');
  }
  if (status !== undefined && status >= 500 && status < 600) {
    throw errors.google('Google no esta disponible temporalmente. Intentalo de nuevo en unos segundos.');
  }
  if (isRetryableGoogleReadError(error)) {
    throw errors.google('No pudimos comunicarnos temporalmente con Google. Intentalo de nuevo.');
  }
  throw error;
}

async function withConnectionRecovery<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    return recoverConnectionError(uid, error);
  }
}

export async function ensureFinancialSpreadsheet(uid: string) {
  const lease = await acquireProvisionLease(uid);
  let client: GoogleOAuthClient;
  try {
    client = await getAuthorizedGoogleClient(uid);
  } catch (error) {
    if (lease.kind === 'acquired') await releaseProvisionLease(uid, lease.leaseId, 'authorized');
    return recoverConnectionError(uid, error);
  }
  if (lease.kind === 'existing') {
    try {
      // Metadata is the primary pointer, but look for the app-owned Drive
      // marker too so a duplicate managed Sheet cannot remain undetected
      // after a previous successful connection.
      const managedSpreadsheetId = await findManagedSpreadsheet(client, uid);
      if (managedSpreadsheetId && managedSpreadsheetId !== lease.spreadsheetId) {
        throw errors.conflict('Encontramos un archivo financiero administrado distinto al que esta conectado. Desconecta Google Sheets y vuelve a conectarlo para resolver la conexion.');
      }
      await verifySpreadsheetAccessible(client, lease.spreadsheetId);
      await initialiseSpreadsheet(client, lease.spreadsheetId);
      await markConnected(uid, lease.spreadsheetId, SHEET_SCHEMA_VERSION);
      return lease.spreadsheetId;
    } catch (error) {
      if (error instanceof AppError && error.code === 'SHEET_NOT_FOUND') {
        await markConnectionStatus(uid, 'file_missing');
      }
      return recoverConnectionError(uid, error);
    }
  }
  if (lease.kind === 'busy') throw errors.conflict('Tu archivo se está preparando. Espera unos segundos y vuelve a intentar.');

  try {
    let spreadsheetId = await findManagedSpreadsheet(client, uid);
    if (!spreadsheetId) {
      const drive = getDrive(client);
      const created = await drive.files.create({
        requestBody: {
          name: getFinancialSheetTitle(),
          mimeType: 'application/vnd.google-apps.spreadsheet',
          appProperties: {
            financialOwner: getOwnerKey(uid),
            financialSchemaVersion: String(SHEET_SCHEMA_VERSION),
          },
        },
        fields: 'id',
      });
      spreadsheetId = created.data.id ?? undefined;
    }
    if (!spreadsheetId) throw errors.google('No pudimos crear tu archivo financiero en Google Drive.');
    await initialiseSpreadsheet(client, spreadsheetId);
    await markConnected(uid, spreadsheetId, SHEET_SCHEMA_VERSION);
    return spreadsheetId;
  } catch (error) {
    await releaseProvisionLease(uid, lease.leaseId, 'authorized');
    return recoverConnectionError(uid, error);
  }
}

async function getConnectedSpreadsheet(uid: string): Promise<{ client: GoogleOAuthClient; spreadsheetId: string }> {
  const connection = await getConnection(uid);
  if (!connection?.spreadsheetId) throw errors.sheetNotFound();
  if (connection.status === 'reauth_required') throw errors.reauthorization();
  if (connection.status === 'file_missing') throw errors.sheetNotFound('No encontramos tu archivo financiero. Vuelve a conectarlo para crear uno nuevo.');
  const client = await getAuthorizedGoogleClient(uid);
  return { client, spreadsheetId: connection.spreadsheetId };
}

export async function loadFinancialSnapshot(uid: string): Promise<FinancialSnapshot> {
  const { client, spreadsheetId } = await getConnectedSpreadsheet(uid);
  try {
    const sheets = getSheets(client);
    const response = await withGoogleReadRetry(() => sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [
        a1(SHEET_NAMES.transactions, 'A:S'),
        a1(SHEET_NAMES.categories, 'A:G'),
        a1(SHEET_NAMES.budgets, 'A:J'),
        a1(SHEET_NAMES.recurrences, 'A:L'),
        a1(SHEET_NAMES.configuration, 'A:C'),
      ],
      valueRenderOption: 'UNFORMATTED_VALUE',
    }));
    const ranges = response.data.valueRanges ?? [];
    const categoryResult = parseCategories((ranges[1]?.values ?? []) as SheetRow[]);
    const transactionResult = parseTransactionRows((ranges[0]?.values ?? []) as SheetRow[], categoryResult.categories);
    const budgetResult = parseBudgets((ranges[2]?.values ?? []) as SheetRow[], categoryResult.categories);
    const recurrenceResult = parseRecurrences((ranges[3]?.values ?? []) as SheetRow[]);
    const preferences = parsePreferences((ranges[4]?.values ?? []) as SheetRow[]);
    const budgets = budgetResult.budgets.map((budget) => ({
      ...budget,
      spentAmount: transactionResult.transactions
        .filter((transaction) => transaction.type === 'expense' && !transaction.deletedAt)
        .filter((transaction) => transaction.categoryId === budget.categoryId || transaction.category === budget.category)
        .filter((transaction) => !budget.startDate || transaction.date >= budget.startDate)
        .filter((transaction) => !budget.endDate || transaction.date <= budget.endDate)
        .reduce((total, transaction) => total + transaction.amount, 0),
    }));
    const snapshot: FinancialSnapshot = {
      transactions: transactionResult.transactions
        .filter((transaction) => !transaction.deletedAt)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
      categories: categoryResult.categories.filter((category) => category.active),
      budgets,
      recurrences: recurrenceResult.recurrences.filter((recurrence) => !recurrence.deletedAt),
      preferences,
      analytics: calculateAnalytics(transactionResult.transactions, budgets, { timezone: preferences.timezone }),
      validationIssues: [...categoryResult.issues, ...transactionResult.issues, ...budgetResult.issues, ...recurrenceResult.issues],
      syncedAt: nowIso(),
    };
    await touchLastSync(uid);
    return snapshot;
  } catch (error) {
    return recoverConnectionError(uid, error);
  }
}

async function readTransactionTable(uid: string): Promise<{ sheets: ReturnType<typeof getSheets>; spreadsheetId: string; parsed: ReturnType<typeof parseTransactionRows>; categories: Category[]; recurrenceIds: Set<string> }> {
  const { client, spreadsheetId } = await getConnectedSpreadsheet(uid);
  const sheets = getSheets(client);
  const response = await withGoogleReadRetry(() => sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [a1(SHEET_NAMES.transactions, 'A:S'), a1(SHEET_NAMES.categories, 'A:G'), a1(SHEET_NAMES.recurrences, 'A:L')],
    valueRenderOption: 'UNFORMATTED_VALUE',
  }));
  const ranges = response.data.valueRanges ?? [];
  const categoryResult = parseCategories((ranges[1]?.values ?? []) as SheetRow[]);
  const recurrenceIds = new Set(
    ((ranges[2]?.values ?? []) as SheetRow[])
      .slice(1)
      .map((row) => clean(row[0]))
      .filter(Boolean),
  );
  return {
    sheets,
    spreadsheetId,
    parsed: parseTransactionRows((ranges[0]?.values ?? []) as SheetRow[], categoryResult.categories),
    categories: categoryResult.categories,
    recurrenceIds,
  };
}

function assertTransactionInput(input: TransactionWriteInput, categories: Category[]): void {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw errors.validation('El monto debe ser mayor que cero.');
  if (!input.description.trim()) throw errors.validation('Ingresa una descripción.');
  if (!input.category.trim()) throw errors.validation('Selecciona una categoría.');
  if (!isDate(input.date)) throw errors.validation('La fecha debe tener el formato YYYY-MM-DD.');
  if (!PAYMENT_METHODS.includes(input.paymentMethod)) throw errors.validation('Selecciona un método de pago válido.');
  if (input.categoryId && !categories.some((category) => category.id === input.categoryId && category.active)) {
    throw errors.validation('La categoría seleccionada ya no está disponible.');
  }
  if (input.type === 'expense') {
    if (!EXPENSE_COST_TYPES.has(input.costType)) throw errors.validation('Selecciona una clasificación de gasto válida.');
    if (input.fixedVariable !== 'Fijo' && input.fixedVariable !== 'Variable') throw errors.validation('Selecciona si el gasto es fijo o variable.');
    if (input.necessity !== 'Necesario' && input.necessity !== 'Innecesario') throw errors.validation('Selecciona si el gasto era necesario o innecesario.');
    if (!input.influence || input.influence < 1 || input.influence > 5) throw errors.validation('Selecciona una influencia del 1 al 5.');
  }
}

export async function appendTransaction(uid: string, transactionId: string, input: TransactionWriteInput): Promise<Transaction> {
  return withConnectionRecovery(uid, async () => {
    const table = await readTransactionTable(uid);
    const existing = table.parsed.transactions.find((transaction) => transaction.id === transactionId);
    if (existing) return existing;
    assertTransactionInput(input, table.categories);
    const recurringId = input.recurring ? recurrenceIdForTransaction(transactionId) : undefined;
    const transaction = buildTransaction(input, transactionId, nowIso(), nowIso(), recurringId);
    if (recurringId && !table.recurrenceIds.has(recurringId)) {
      const nextDate = new Date(`${transaction.date}T12:00:00.000Z`);
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
      await table.sheets.spreadsheets.values.append({
        spreadsheetId: table.spreadsheetId,
        range: a1(SHEET_NAMES.recurrences, 'A:L'),
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[
            recurringId,
            transaction.type === 'income' ? 'Ingreso' : 'Gasto',
            transaction.description,
            transaction.categoryId ?? '',
            transaction.category,
            transaction.amount,
            'Mensual',
            nextDate.toISOString().slice(0, 10),
            true,
            transaction.createdAt,
            transaction.updatedAt,
            '',
          ]],
        },
      });
    }
    await table.sheets.spreadsheets.values.append({
      spreadsheetId: table.spreadsheetId,
      range: a1(SHEET_NAMES.transactions, 'A:S'),
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [makeMovementRow(transaction)] },
    });
    return transaction;
  });
}

export async function updateTransaction(
  uid: string,
  id: string,
  expectedUpdatedAt: string,
  input: TransactionWriteInput,
): Promise<Transaction> {
  return withConnectionRecovery(uid, async () => {
    const table = await readTransactionTable(uid);
    const current = table.parsed.transactions.find((transaction) => transaction.id === id);
    const row = table.parsed.rowsById.get(id);
    if (!current || !row) throw errors.sheetNotFound('No encontramos el movimiento que quieres actualizar.');
    if (current.deletedAt) throw errors.conflict('Ese movimiento ya fue eliminado. Actualiza la información antes de continuar.');
    if (current.updatedAt !== expectedUpdatedAt) throw errors.conflict('Este movimiento cambió en otro lugar. Sincroniza y vuelve a intentarlo.');
    assertTransactionInput(input, table.categories);
    const updated = buildTransaction(input, id, current.createdAt, nowIso(), current.recurringId);
    await table.sheets.spreadsheets.values.update({
      spreadsheetId: table.spreadsheetId,
      range: a1(SHEET_NAMES.transactions, `A${row}:S${row}`),
      valueInputOption: 'RAW',
      requestBody: { values: [makeMovementRow(updated)] },
    });
    return updated;
  });
}

export async function softDeleteTransaction(uid: string, id: string, expectedUpdatedAt: string): Promise<void> {
  return withConnectionRecovery(uid, async () => {
    const table = await readTransactionTable(uid);
    const current = table.parsed.transactions.find((transaction) => transaction.id === id);
    const row = table.parsed.rowsById.get(id);
    if (!current || !row) throw errors.sheetNotFound('No encontramos el movimiento que quieres eliminar.');
    if (current.updatedAt !== expectedUpdatedAt) throw errors.conflict('Este movimiento cambió en otro lugar. Sincroniza y vuelve a intentarlo.');
    const updatedAt = nowIso();
    await table.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: table.spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          { range: a1(SHEET_NAMES.transactions, `R${row}`), values: [[updatedAt]] },
          { range: a1(SHEET_NAMES.transactions, `S${row}`), values: [[updatedAt]] },
        ],
      },
    });
  });
}

export async function softDeleteAllTransactions(uid: string): Promise<void> {
  return withConnectionRecovery(uid, async () => {
    const table = await readTransactionTable(uid);
    const updatedAt = nowIso();
    const updates = table.parsed.transactions
      .filter((transaction) => !transaction.deletedAt)
      .flatMap((transaction) => {
        const row = table.parsed.rowsById.get(transaction.id);
        return row ? [
          { range: a1(SHEET_NAMES.transactions, `R${row}`), values: [[updatedAt]] },
          { range: a1(SHEET_NAMES.transactions, `S${row}`), values: [[updatedAt]] },
        ] : [];
      });
    if (updates.length === 0) return;
    await table.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: table.spreadsheetId,
      requestBody: { valueInputOption: 'RAW', data: updates },
    });
  });
}

/**
 * Permanently clears user-entered financial rows from the connected Sheet.
 * The header row, category catalogue, and configuration are kept so the same
 * workbook can continue to be used after the user starts over.
 */
export async function purgeFinancialData(uid: string): Promise<void> {
  return withConnectionRecovery(uid, async () => {
    const { client, spreadsheetId } = await getConnectedSpreadsheet(uid);
    const sheets = getSheets(client);
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: {
        ranges: [
          a1(SHEET_NAMES.transactions, `A2:${columnLabel(MOVEMENT_HEADERS.length)}`),
          a1(SHEET_NAMES.budgets, `A2:${columnLabel(BUDGET_HEADERS.length)}`),
          a1(SHEET_NAMES.recurrences, `A2:${columnLabel(RECURRENCE_HEADERS.length)}`),
        ],
      },
    });
    await touchLastSync(uid);
  });
}

export async function upsertBudget(uid: string, input: BudgetWriteInput): Promise<CategoryBudget> {
  return withConnectionRecovery(uid, async () => {
    const { client, spreadsheetId } = await getConnectedSpreadsheet(uid);
    const sheets = getSheets(client);
    const response = await withGoogleReadRetry(() => sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [a1(SHEET_NAMES.budgets, 'A:J'), a1(SHEET_NAMES.categories, 'A:G')],
      valueRenderOption: 'UNFORMATTED_VALUE',
    }));
    const ranges = response.data.valueRanges ?? [];
    const budgetValues = (ranges[0]?.values ?? []) as SheetRow[];
    const categoryResult = parseCategories((ranges[1]?.values ?? []) as SheetRow[]);
    const budgetResult = parseBudgets(budgetValues, categoryResult.categories);
    const category = categoryResult.categories.find((item) => item.id === input.categoryId && item.active);
    if (!category) throw errors.validation('La categoría del presupuesto ya no está disponible.');
    if (!Number.isFinite(input.amount) || input.amount < 0) throw errors.validation('El límite del presupuesto no es válido.');
    const id = input.id ?? randomUUID();
    const current = budgetResult.budgets.find((budget) => budget.id === id);
    if (current && (!input.expectedUpdatedAt || current.updatedAt !== input.expectedUpdatedAt)) {
      throw errors.conflict('Este presupuesto cambió en otro lugar. Sincroniza y vuelve a intentarlo.');
    }
    const now = nowIso();
    const row: SheetRow = [id, input.categoryId, input.amount, input.period, input.startDate, input.endDate, input.active, current?.createdAt ?? now, now, ''];
    const parsedHeaders = makeHeaderIndex((budgetValues[0] ?? []) as SheetRow, BUDGET_HEADERS, SHEET_NAMES.budgets);
    const rowIndex = budgetValues.findIndex((value, index) => index > 0 && clean(value[parsedHeaders.get('id') ?? 0]) === id);
    if (rowIndex > 0) {
      await sheets.spreadsheets.values.update({ spreadsheetId, range: a1(SHEET_NAMES.budgets, `A${rowIndex + 1}:J${rowIndex + 1}`), valueInputOption: 'RAW', requestBody: { values: [row] } });
    } else {
      await sheets.spreadsheets.values.append({ spreadsheetId, range: a1(SHEET_NAMES.budgets, 'A:J'), valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [row] } });
    }
    return { id, categoryId: input.categoryId, category: category.name, allocatedAmount: input.amount, spentAmount: 0, period: input.period, startDate: input.startDate, endDate: input.endDate, active: input.active, createdAt: current?.createdAt ?? now, updatedAt: now };
  });
}

export async function updatePreferences(
  uid: string,
  preferences: Partial<Pick<FinancialPreferences, 'currency' | 'dateFormat' | 'timezone' | 'monthlyBudget'>>,
  expectedUpdatedAt: string,
): Promise<FinancialPreferences> {
  return withConnectionRecovery(uid, async () => {
    const { client, spreadsheetId } = await getConnectedSpreadsheet(uid);
    const sheets = getSheets(client);
    const current = await withGoogleReadRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: a1(SHEET_NAMES.configuration, 'A:C'), valueRenderOption: 'UNFORMATTED_VALUE' }));
    const parsed = parsePreferences((current.data.values ?? []) as SheetRow[]);
    if (!parsed.updatedAt || parsed.updatedAt !== expectedUpdatedAt) {
      throw errors.conflict('La configuración cambió en otro lugar. Sincroniza y vuelve a intentarlo.');
    }
    const next: FinancialPreferences = {
      ...parsed,
      ...preferences,
      schemaVersion: SHEET_SCHEMA_VERSION,
    };
    if (!Number.isFinite(next.monthlyBudget) || next.monthlyBudget < 0) throw errors.validation('El presupuesto mensual debe ser igual o mayor que cero.');
    const now = nowIso();
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: a1(SHEET_NAMES.configuration, 'A1:C6'),
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          Array.from(CONFIGURATION_HEADERS),
          ['moneda', next.currency, now],
          ['formato_fecha', next.dateFormat, now],
          ['timezone', next.timezone, now],
          ['presupuesto_mensual_total', next.monthlyBudget, now],
          ['version_schema', SHEET_SCHEMA_VERSION, now],
        ],
      },
    });
    return { ...next, updatedAt: now };
  });
}
