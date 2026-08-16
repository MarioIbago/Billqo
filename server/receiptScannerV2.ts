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

  // Keep known, current multimodal paid routes first so a stale environment
  // override cannot make an unavailable free model the primary generation path.
  // Explicit custom paid routes are still honored afterwards; explicitly
  // configured free routes remain a last-resort fallback only.
  return [...new Set([
    DEFAULT_PRIMARY_MODEL,
    DEFAULT_SECONDARY_MODEL,
    DEFAULT_TERTIARY_MODEL,
    ...requestedPaid,
    ...requestedFree,
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
        // json_object is intentionally used instead of a strict provider-level
        // json_schema. Zod still validates the response server-side, while this
        // avoids excluding otherwise healthy vision providers that do not
        // implement the exact same structured-output dialect.
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
        return parseReceiptModelResult(response.content, input.allowedCategories);
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
      // Model-specific 400/404/422 errors are recoverable here: another model
      // can still process the same image, so do not misreport them as a global
      // CONFIGURATION_ERROR.
    }
  }

  if (sawRateLimit && lastFailure instanceof ReceiptProviderFailure && lastFailure.status === 429) {
    throw errors.rateLimited('El escáner está recibiendo demasiadas solicitudes. Inténtalo de nuevo en un momento.');
  }

  throw errors.ai('No pudimos analizar el comprobante con los modelos disponibles. Inténtalo de nuevo o captura los datos manualmente.', lastFailure);
}
