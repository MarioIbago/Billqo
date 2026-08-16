import type { ReceiptScanResult, TransactionType } from '../src/types';
import { AppError, errors } from './errors';
import { parseReceiptModelResult, RECEIPT_SYSTEM_PROMPT } from './receiptScanner';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_PRIMARY_MODEL = 'google/gemini-2.5-flash-lite';
const DEFAULT_SECONDARY_MODEL = 'google/gemini-2.5-flash';
const DEFAULT_TERTIARY_MODEL = 'google/gemma-3-4b-it';

interface ProviderError {
  code?: string | number;
  message?: string;
  metadata?: {
    error_type?: string;
    provider_code?: string | number;
  };
}

interface OpenRouterPayload {
  model?: string;
  error?: ProviderError;
  choices?: Array<{
    finish_reason?: string | null;
    error?: ProviderError;
    message?: {
      content?: string | Array<{ type?: string; text?: string }> | null;
    };
  }>;
}

type JsonRecord = Record<string, unknown>;

class ReceiptProviderFailure extends Error {
  constructor(
    public readonly status: number,
    public readonly providerCode: string,
    public readonly route: string,
    public readonly model: string,
  ) {
    super(`Receipt provider failed (${status || 'network'})`);
    this.name = 'ReceiptProviderFailure';
  }
}

function isFreeModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return normalized === 'openrouter/free' || normalized.endsWith(':free');
}

function configuredModels(): string[] {
  const requestedModels = [
    process.env.OPENROUTER_RECEIPT_MODEL?.trim(),
    process.env.OPENROUTER_RECEIPT_PAID_MODEL?.trim(),
    process.env.OPENROUTER_RECEIPT_FALLBACK_MODEL?.trim(),
  ].filter((model): model is string => Boolean(model));

  const requestedPaid = requestedModels.filter((model) => !isFreeModel(model));
  const requestedFree = requestedModels.filter(isFreeModel);
  const allowFreeModels = process.env.OPENROUTER_RECEIPT_ALLOW_FREE?.trim().toLowerCase() === 'true';

  // Vision receipt scanning is a production path. Keep current multimodal paid
  // routes first and do not rely on the free router unless explicitly enabled:
  // its pool changes over time and may temporarily have no endpoint satisfying
  // the image/structured-output/privacy constraints of this request.
  return [...new Set([
    DEFAULT_PRIMARY_MODEL,
    DEFAULT_SECONDARY_MODEL,
    DEFAULT_TERTIARY_MODEL,
    ...requestedPaid,
    ...(allowFreeModels ? requestedFree : []),
  ])];
}

function providerCode(error: ProviderError | undefined): string {
  const value = error?.metadata?.provider_code
    ?? error?.metadata?.error_type
    ?? error?.code
    ?? 'unknown';
  return String(value).slice(0, 80);
}

function providerStatus(error: ProviderError | undefined): number {
  const value = Number(error?.code);
  return Number.isInteger(value) && value >= 400 && value <= 599 ? value : 502;
}

function extractContent(payload: OpenRouterPayload): string | undefined {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return undefined;
  const joined = content
    .map((part) => typeof part?.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('\n');
  return joined || undefined;
}

function normalizeJsonText(raw: string): string {
  let value = raw.trim();
  if (value.startsWith('```')) {
    value = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  const firstBrace = value.indexOf('{');
  const lastBrace = value.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) value = value.slice(firstBrace, lastBrace + 1);
  return value.trim();
}

function requestInstruction(preferredType: TransactionType | undefined, allowedCategories: string[]): string {
  const preferred = preferredType ?? 'expense';
  const categories = JSON.stringify(allowedCategories);
  return [
    `Tipo preferido: ${preferred}.`,
    `Categorías permitidas: ${categories}.`,
    'Devuelve únicamente UN objeto JSON válido, sin markdown ni texto antes o después.',
    'Usa exactamente estas claves:',
    'documentType, isFinancialDocument, type, merchant, description, amount, currency, date, paymentMethod, category, costType, fixedVariable, necessity, influence, confidence, warnings.',
    'documentType debe ser ticket, receipt, invoice, payment_proof u other.',
    'Cuando un dato no esté sustentado visualmente usa null. warnings siempre debe ser un arreglo JSON.',
    'Clasifica primero el documento y solo extrae datos financieros cuando exista evidencia visual suficiente.',
  ].join(' ');
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstValue(record: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
  }
  return undefined;
}

function unwrapCandidate(value: unknown): JsonRecord | undefined {
  if (!isRecord(value)) return undefined;
  for (const key of ['receipt', 'ticket', 'result', 'data', 'document']) {
    const nested = value[key];
    if (isRecord(nested)) return nested;
  }
  return value;
}

function normalizedToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

function nullableString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  const token = normalizedToken(value);
  if (['true', 'si', 'yes', '1'].includes(token)) return true;
  if (['false', 'no', '0'].includes(token)) return false;
  return undefined;
}

function documentTypeValue(value: unknown): 'ticket' | 'receipt' | 'invoice' | 'payment_proof' | 'other' | undefined {
  const token = normalizedToken(value);
  if (!token) return undefined;
  if (['ticket', 'nota de venta', 'sales ticket'].includes(token)) return 'ticket';
  if (['receipt', 'recibo'].includes(token)) return 'receipt';
  if (['invoice', 'factura', 'cfdi'].includes(token)) return 'invoice';
  if (['payment proof', 'payment proof receipt', 'comprobante de pago', 'comprobante pago', 'transfer proof', 'comprobante de transferencia'].includes(token)) return 'payment_proof';
  if (['other', 'otro', 'unknown', 'desconocido'].includes(token)) return 'other';
  return undefined;
}

function transactionTypeValue(value: unknown, preferredType: TransactionType | undefined): TransactionType {
  const token = normalizedToken(value);
  if (['income', 'ingreso', 'entrada', 'deposito', 'deposit'].includes(token)) return 'income';
  if (['expense', 'gasto', 'egreso', 'compra', 'purchase'].includes(token)) return 'expense';
  return preferredType ?? 'expense';
}

function numericAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;

  let text = value.trim().replace(/[^\d.,-]/g, '');
  if (!text) return null;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) text = text.replace(/\./g, '').replace(',', '.');
    else text = text.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const decimals = text.length - lastComma - 1;
    text = decimals === 1 || decimals === 2 ? text.replace(',', '.') : text.replace(/,/g, '');
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function currencyValue(value: unknown): string | null {
  const text = nullableString(value, 12)?.toUpperCase().replace(/[^A-Z]/g, '') ?? '';
  return /^[A-Z]{3}$/.test(text) ? text : null;
}

function dateValue(value: unknown): string | null {
  const text = nullableString(value, 40);
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const local = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!local) return null;
  const day = Number(local[1]);
  const month = Number(local[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${local[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function paymentMethodValue(value: unknown): 'Efectivo' | 'Tarjeta Débito' | 'Tarjeta Crédito' | 'Transferencia' | null {
  const token = normalizedToken(value);
  if (!token) return null;
  if (token.includes('efectivo') || token === 'cash') return 'Efectivo';
  if (token.includes('debito') || token.includes('debit')) return 'Tarjeta Débito';
  if (token.includes('credito') || token.includes('credit')) return 'Tarjeta Crédito';
  if (token.includes('transfer') || token.includes('spei')) return 'Transferencia';
  return null;
}

function costTypeValue(value: unknown, type: TransactionType): 'Fijo' | 'Variable' | 'Discrecional' | 'Operativo' | 'Hormiga' | 'Ingreso' | null {
  if (type === 'income') return 'Ingreso';
  const token = normalizedToken(value);
  if (token === 'fijo' || token === 'fixed') return 'Fijo';
  if (token === 'variable') return 'Variable';
  if (token === 'discrecional' || token === 'discretionary') return 'Discrecional';
  if (token === 'operativo' || token === 'operational') return 'Operativo';
  if (token === 'hormiga') return 'Hormiga';
  return null;
}

function fixedVariableValue(value: unknown, costType: string | null, type: TransactionType): 'Fijo' | 'Variable' | null {
  if (type === 'income') return null;
  const token = normalizedToken(value);
  if (token === 'fijo' || token === 'fixed') return 'Fijo';
  if (token === 'variable') return 'Variable';
  if (costType === 'Fijo') return 'Fijo';
  if (costType === 'Variable' || costType === 'Discrecional' || costType === 'Operativo' || costType === 'Hormiga') return 'Variable';
  return null;
}

function necessityValue(value: unknown, type: TransactionType): 'Necesario' | 'Innecesario' | null {
  if (type === 'income') return null;
  const token = normalizedToken(value);
  if (['necesario', 'necessary', 'essential'].includes(token)) return 'Necesario';
  if (['innecesario', 'unnecessary', 'nonessential', 'no necesario'].includes(token)) return 'Innecesario';
  return null;
}

function influenceValue(value: unknown, type: TransactionType): 1 | 2 | 3 | 4 | 5 | null {
  if (type === 'income') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded >= 1 && rounded <= 5 ? rounded as 1 | 2 | 3 | 4 | 5 : null;
}

function confidenceValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim().replace('%', ''));
  if (!Number.isFinite(parsed)) return 0.35;
  const normalized = parsed > 1 && parsed <= 100 ? parsed / 100 : parsed;
  return Math.min(1, Math.max(0, normalized));
}

function warningValues(value: unknown): string[] {
  const candidates = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return [...new Set(candidates
    .map((warning) => nullableString(warning, 180))
    .filter((warning): warning is string => Boolean(warning)))]
    .slice(0, 6);
}

function normalizeReceiptCandidate(raw: string, preferredType: TransactionType | undefined): JsonRecord | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizeJsonText(raw));
  } catch {
    return undefined;
  }

  const source = unwrapCandidate(parsed);
  if (!source) return undefined;

  const type = transactionTypeValue(firstValue(source, ['type', 'transactionType', 'transaction_type', 'tipo']), preferredType);
  let documentType = documentTypeValue(firstValue(source, ['documentType', 'document_type', 'document', 'tipoDocumento', 'tipo_documento']));
  const explicitFinancial = booleanValue(firstValue(source, ['isFinancialDocument', 'is_financial_document', 'financialDocument', 'esDocumentoFinanciero']));

  const merchant = nullableString(firstValue(source, ['merchant', 'merchantName', 'merchant_name', 'store', 'vendor', 'seller', 'issuer', 'comercio', 'establecimiento', 'emisor', 'negocio']), 160);
  const description = nullableString(firstValue(source, ['description', 'descripcion', 'descripción', 'concept', 'concepto', 'summary', 'resumen']), 200);
  const amount = numericAmount(firstValue(source, ['amount', 'total', 'totalAmount', 'total_amount', 'grandTotal', 'grand_total', 'monto', 'importe', 'paidTotal', 'paid_total']));

  if (!documentType && explicitFinancial === true && (amount !== null || merchant !== null)) documentType = 'receipt';
  documentType ??= 'other';
  const isFinancialDocument = explicitFinancial ?? documentType !== 'other';
  const costType = costTypeValue(firstValue(source, ['costType', 'cost_type', 'tipoCosto', 'tipo_costo']), type);

  return {
    documentType,
    isFinancialDocument,
    type,
    merchant,
    description: description ?? merchant,
    amount,
    currency: currencyValue(firstValue(source, ['currency', 'currencyCode', 'currency_code', 'moneda'])),
    date: dateValue(firstValue(source, ['date', 'transactionDate', 'transaction_date', 'purchaseDate', 'purchase_date', 'fecha'])),
    paymentMethod: paymentMethodValue(firstValue(source, ['paymentMethod', 'payment_method', 'payment', 'method', 'metodoPago', 'métodoPago', 'metodo_pago'])),
    category: nullableString(firstValue(source, ['category', 'categoria', 'categoría']), 120),
    costType,
    fixedVariable: fixedVariableValue(firstValue(source, ['fixedVariable', 'fixed_variable', 'fijoVariable', 'fijo_variable']), costType, type),
    necessity: necessityValue(firstValue(source, ['necessity', 'necesidad']), type),
    influence: influenceValue(firstValue(source, ['influence', 'influencia', 'impulse', 'impulso']), type),
    confidence: confidenceValue(firstValue(source, ['confidence', 'confianza'])),
    warnings: warningValues(firstValue(source, ['warnings', 'advertencias', 'notes', 'notas'])),
  };
}

function parseReceiptWithRecovery(
  raw: string,
  allowedCategories: string[],
  preferredType: TransactionType | undefined,
): ReceiptScanResult {
  try {
    return parseReceiptModelResult(raw, allowedCategories);
  } catch (error) {
    // A correct non-financial classification must remain a hard user-facing
    // validation result. Only schema/format drift from the model is repaired.
    if (error instanceof AppError && error.code === 'VALIDATION_FAILED') throw error;

    const normalized = normalizeReceiptCandidate(raw, preferredType);
    if (!normalized) throw error;
    return parseReceiptModelResult(JSON.stringify(normalized), allowedCategories);
  }
}

async function requestModel(input: {
  image: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  allowedCategories: string[];
  preferredType?: TransactionType;
  model: string;
  route: string;
}): Promise<{ content: string; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw errors.configuration('El escáner de comprobantes todavía no está configurado.');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Title': 'Billqo',
  };
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) headers['HTTP-Referer'] = appUrl;

  let response: Response;
  try {
    response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(35_000),
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: 'system', content: RECEIPT_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: requestInstruction(input.preferredType, input.allowedCategories) },
              {
                type: 'image_url',
                image_url: { url: `data:${input.mimeType};base64,${input.image.toString('base64')}` },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        provider: {
          allow_fallbacks: true,
          data_collection: 'deny',
        },
        temperature: 0,
        max_tokens: 900,
        stream: false,
      }),
    });
  } catch (error) {
    const code = error instanceof Error ? error.name : 'network_error';
    console.error('OpenRouter receipt request failed', {
      status: 0,
      code,
      route: input.route,
      model: input.model,
    });
    throw new ReceiptProviderFailure(0, code, input.route, input.model);
  }

  let payload: OpenRouterPayload | undefined;
  try {
    payload = await response.json() as OpenRouterPayload;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const code = providerCode(payload?.error);
    console.error('OpenRouter receipt request failed', {
      status: response.status,
      code,
      route: input.route,
      model: input.model,
    });
    throw new ReceiptProviderFailure(response.status, code, input.route, input.model);
  }

  const choice = payload?.choices?.[0];
  const generationError = choice?.error ?? payload?.error;
  if (generationError || choice?.finish_reason === 'error') {
    const status = providerStatus(generationError);
    const code = providerCode(generationError);
    console.error('OpenRouter receipt generation failed', {
      status,
      code,
      route: input.route,
      model: payload?.model ?? input.model,
    });
    throw new ReceiptProviderFailure(status, code, input.route, input.model);
  }

  const content = payload ? extractContent(payload) : undefined;
  if (!content?.trim()) {
    console.error('OpenRouter receipt response invalid', {
      route: input.route,
      code: 'empty_content',
      model: payload?.model ?? input.model,
    });
    throw new ReceiptProviderFailure(502, 'empty_content', input.route, input.model);
  }

  return { content: normalizeJsonText(content), model: payload?.model ?? input.model };
}

function isCredentialFailure(error: unknown): error is ReceiptProviderFailure {
  return error instanceof ReceiptProviderFailure && [401, 402, 403].includes(error.status);
}

function mapCredentialFailure(error: ReceiptProviderFailure): AppError {
  if (error.status === 402) {
    return errors.configuration('La cuenta de OpenRouter necesita saldo o habilitación para procesar comprobantes.');
  }
  return errors.configuration('La conexión de Billqo con OpenRouter necesita atención.');
}

export async function scanReceiptImageV2(input: {
  image: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  allowedCategories: string[];
  preferredType?: TransactionType;
}): Promise<ReceiptScanResult> {
  const models = configuredModels();
  let lastFailure: unknown;
  let sawRateLimit = false;

  for (const [index, model] of models.entries()) {
    const route = index === 0 ? 'primary' : `fallback-${index}`;
    try {
      const response = await requestModel({ ...input, model, route });
      try {
        return parseReceiptWithRecovery(response.content, input.allowedCategories, input.preferredType);
      } catch (error) {
        if (error instanceof AppError && error.code === 'VALIDATION_FAILED') throw error;
        lastFailure = error;
        console.warn('Receipt model output rejected', {
          model: response.model,
          code: error instanceof AppError ? error.code : 'invalid_output',
        });
      }
    } catch (error) {
      if (error instanceof AppError && error.code === 'VALIDATION_FAILED') throw error;
      if (isCredentialFailure(error)) throw mapCredentialFailure(error);
      if (error instanceof ReceiptProviderFailure && error.status === 429) sawRateLimit = true;
      lastFailure = error;
    }
  }

  if (sawRateLimit && lastFailure instanceof ReceiptProviderFailure && lastFailure.status === 429) {
    throw errors.rateLimited('El escáner está recibiendo demasiadas solicitudes. Inténtalo de nuevo en un momento.');
  }

  throw errors.ai('No pudimos analizar el comprobante con los modelos disponibles. Inténtalo de nuevo o captura los datos manualmente.', lastFailure);
}
