import { afterEach, describe, expect, it, vi } from 'vitest';
import { scanReceiptImageV2 } from '../server/receiptScannerV2';

function jpegBuffer(): Buffer {
  const buffer = Buffer.alloc(64, 0);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return buffer;
}

function validExpense() {
  return {
    documentType: 'ticket',
    isFinancialDocument: true,
    type: 'expense',
    merchant: 'Comercio',
    description: 'Compra',
    amount: 125.5,
    currency: 'MXN',
    date: '2026-08-15',
    paymentMethod: 'Tarjeta Débito',
    category: 'Comida',
    costType: 'Variable',
    fixedVariable: 'Variable',
    necessity: 'Necesario',
    influence: 2,
    confidence: 0.94,
    warnings: [],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_RECEIPT_MODEL;
  delete process.env.OPENROUTER_RECEIPT_PAID_MODEL;
  delete process.env.OPENROUTER_RECEIPT_FALLBACK_MODEL;
  delete process.env.OPENROUTER_RECEIPT_ALLOW_FREE;
});

describe('receipt scanner v2', () => {
  it('uses Gemini Flash Lite first even when a stale free model is configured', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_RECEIPT_MODEL = 'google/gemma-3-4b-it:free';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      choices: [{ message: { content: JSON.stringify(validExpense()) } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await scanReceiptImageV2({
      image: jpegBuffer(),
      mimeType: 'image/jpeg',
      allowedCategories: ['Comida'],
      preferredType: 'expense',
    });

    expect(result.amount).toBe(125.5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.model).toBe('google/gemini-2.5-flash-lite');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.provider).toEqual({ allow_fallbacks: true, data_collection: 'deny' });
    expect(body.provider.require_parameters).toBeUndefined();
  });

  it('continues after a model-specific 400 and accepts fenced JSON from Gemini Flash', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 400 } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'google/gemini-2.5-flash',
        choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(validExpense())}\n\`\`\`` } }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await scanReceiptImageV2({
      image: jpegBuffer(),
      mimeType: 'image/jpeg',
      allowedCategories: ['Comida'],
    });

    expect(result.category).toBe('Comida');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(secondBody.model).toBe('google/gemini-2.5-flash');
  });

  it('repairs harmless schema drift instead of rejecting a useful vision result', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const looseResult = {
      data: {
        tipoDocumento: 'Factura',
        esDocumentoFinanciero: 'sí',
        tipo: 'gasto',
        comercio: 'Café Prueba',
        descripcion: 'Consumo',
        total: '$1,234.50',
        moneda: 'mxn',
        fecha: '15/08/2026',
        metodoPago: 'tarjeta de crédito',
        categoria: 'comida',
        tipoCosto: 'variable',
        fijoVariable: 'variable',
        necesidad: 'necesario',
        impulso: '3',
        confianza: '92%',
        advertencias: 'Revisar propina',
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      choices: [{ message: { content: JSON.stringify(looseResult) } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await scanReceiptImageV2({
      image: jpegBuffer(),
      mimeType: 'image/jpeg',
      allowedCategories: ['Comida'],
      preferredType: 'expense',
    });

    expect(result).toMatchObject({
      type: 'expense',
      merchant: 'Café Prueba',
      description: 'Consumo',
      amount: 1234.5,
      currency: 'MXN',
      date: '2026-08-15',
      paymentMethod: 'Tarjeta Crédito',
      category: 'Comida',
      costType: 'Variable',
      fixedVariable: 'Variable',
      necessity: 'Necesario',
      influence: 3,
      confidence: 0.92,
    });
    expect(result.warnings).toContain('Revisar propina');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not use openrouter/free in production fallback unless explicitly enabled', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_RECEIPT_FALLBACK_MODEL = 'openrouter/free';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(scanReceiptImageV2({
      image: jpegBuffer(),
      mimeType: 'image/jpeg',
      allowedCategories: ['Comida'],
    })).rejects.toMatchObject({ status: 502, code: 'AI_PROVIDER_ERROR' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const models = fetchMock.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body)).model);
    expect(models).not.toContain('openrouter/free');
  });

  it('can still opt into the free router for development or low-cost experimentation', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_RECEIPT_FALLBACK_MODEL = 'openrouter/free';
    process.env.OPENROUTER_RECEIPT_ALLOW_FREE = 'true';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'openrouter/free-selected-model',
        choices: [{ message: { content: JSON.stringify(validExpense()) } }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await scanReceiptImageV2({
      image: jpegBuffer(),
      mimeType: 'image/jpeg',
      allowedCategories: ['Comida'],
    });

    expect(result.amount).toBe(125.5);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const fourthBody = JSON.parse(String((fetchMock.mock.calls[3][1] as RequestInit).body));
    expect(fourthBody.model).toBe('openrouter/free');
  });

  it('does not misreport model compatibility failures as CONFIGURATION_ERROR', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 400 } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 422 } }), { status: 422 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(scanReceiptImageV2({
      image: jpegBuffer(),
      mimeType: 'image/jpeg',
      allowedCategories: ['Comida'],
    })).rejects.toMatchObject({ status: 502, code: 'AI_PROVIDER_ERROR' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('still stops immediately for real credential or billing failures', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 402 } }), { status: 402 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(scanReceiptImageV2({
      image: jpegBuffer(),
      mimeType: 'image/jpeg',
      allowedCategories: ['Comida'],
    })).rejects.toMatchObject({ status: 503, code: 'CONFIGURATION_ERROR' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
