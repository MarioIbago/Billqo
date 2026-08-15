import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertReceiptImage,
  detectReceiptImageMime,
  parseReceiptModelResult,
  RECEIPT_SYSTEM_PROMPT,
  scanReceiptImage,
} from '../server/receiptScanner';

function jpegBuffer(): Buffer {
  const buffer = Buffer.alloc(64, 0);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return buffer;
}

function validExpense(overrides: Record<string, unknown> = {}) {
  return {
    documentType: 'ticket',
    isFinancialDocument: true,
    type: 'expense',
    merchant: 'Comercio',
    description: 'Compra',
    amount: 125.5,
    currency: 'MXN',
    date: '2026-08-14',
    paymentMethod: 'Tarjeta Débito',
    category: 'Comida',
    costType: 'Variable',
    fixedVariable: 'Variable',
    necessity: 'Necesario',
    influence: 2,
    confidence: 0.94,
    warnings: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_RECEIPT_MODEL;
  delete process.env.OPENROUTER_RECEIPT_PAID_MODEL;
  delete process.env.OPENROUTER_RECEIPT_FALLBACK_MODEL;
});

describe('receipt scanner', () => {
  it('detects the real image signature instead of trusting Content-Type alone', () => {
    const image = jpegBuffer();
    expect(detectReceiptImageMime(image)).toBe('image/jpeg');
    expect(assertReceiptImage(image, 'image/jpeg')).toBe('image/jpeg');
    expect(() => assertReceiptImage(image, 'image/png')).toThrow();
  });

  it('rejects images that are not financial receipts, tickets, invoices or payment proofs', () => {
    expect(() => parseReceiptModelResult(JSON.stringify(validExpense({
      documentType: 'other',
      isFinancialDocument: false,
      merchant: null,
      description: null,
      amount: null,
      currency: null,
      date: null,
      paymentMethod: null,
      category: null,
      costType: null,
      fixedVariable: null,
      necessity: null,
      influence: null,
      confidence: 0.99,
    })), ['Comida'])).toThrow(/ticket, recibo, factura o comprobante de pago/i);
  });

  it('drops a category that is not in the allowed Billqo categories', () => {
    const result = parseReceiptModelResult(JSON.stringify(validExpense({ category: 'Inventada' })), ['Comida', 'Transporte']);
    expect(result.category).toBeNull();
    expect(result.warnings).toContain('La categoría detectada requiere selección manual.');
  });

  it('rejects malformed or oversized structured output before it reaches the form', () => {
    expect(() => parseReceiptModelResult('{not-json', ['Comida'])).toThrow();
    expect(() => parseReceiptModelResult(JSON.stringify(validExpense({ amount: -1 })), ['Comida'])).toThrow();
    expect(() => parseReceiptModelResult(JSON.stringify(validExpense({ description: 'x'.repeat(201) })), ['Comida'])).toThrow();
  });

  it('keeps the model system prompt free of examples', () => {
    expect(RECEIPT_SYSTEM_PROMPT).not.toMatch(/por ejemplo|ejemplo|e\.g\./i);
  });

  it('uses the OpenRouter free router first and validates mocked structured JSON', async () => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'google/gemma-3-4b-it:free',
      choices: [{ message: { content: JSON.stringify(validExpense()) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await scanReceiptImage({
      image: jpegBuffer(),
      mimeType: 'image/jpeg',
      allowedCategories: ['Comida', 'Transporte'],
      preferredType: 'expense',
    });

    expect(result.amount).toBe(125.5);
    expect(result.category).toBe('Comida');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = request.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-openrouter-key');
    const body = JSON.parse(String(request.body));
    expect(body.model).toBe('openrouter/free');
    expect(body.models).toBeUndefined();
    expect(body.provider).toEqual({ require_parameters: true, data_collection: 'deny' });
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.schema.required).toContain('documentType');
    expect(body.response_format.json_schema.schema.required).toContain('isFinancialDocument');
  });

  it('does not spend a fallback call when the image is classified as non-financial', async () => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'some/free-model',
      choices: [{ message: { content: JSON.stringify(validExpense({
        documentType: 'other',
        isFinancialDocument: false,
        merchant: null,
        description: null,
        amount: null,
        currency: null,
        date: null,
        paymentMethod: null,
        category: null,
        costType: null,
        fixedVariable: null,
        necessity: null,
        influence: null,
      })) } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(scanReceiptImage({
      image: jpegBuffer(),
      mimeType: 'image/jpeg',
      allowedCategories: ['Comida'],
    })).rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses paid cheap models only if the free response cannot be validated', async () => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'some/free-model',
        choices: [{ message: { content: '{bad-json' } }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        choices: [{ message: { content: JSON.stringify(validExpense()) } }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await scanReceiptImage({
      image: jpegBuffer(),
      mimeType: 'image/jpeg',
      allowedCategories: ['Comida'],
    });

    expect(result.amount).toBe(125.5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(secondBody.models).toEqual([
      'google/gemma-3-4b-it',
      'google/gemini-2.5-flash-lite',
    ]);
  });

  it('falls back when the free router has no compatible endpoint', async () => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'google/gemma-3-4b-it',
        choices: [{ message: { content: JSON.stringify(validExpense()) } }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await scanReceiptImage({
      image: jpegBuffer(),
      mimeType: 'image/jpeg',
      allowedCategories: ['Comida'],
    });

    expect(result.category).toBe('Comida');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns a configuration error for OpenRouter credential or billing failures without retrying', async () => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 402 } }), { status: 402 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(scanReceiptImage({
      image: jpegBuffer(),
      mimeType: 'image/jpeg',
      allowedCategories: ['Comida'],
    })).rejects.toMatchObject({ status: 503, code: 'CONFIGURATION_ERROR' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});