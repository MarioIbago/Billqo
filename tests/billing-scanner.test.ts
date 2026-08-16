import { afterEach, describe, expect, it, vi } from 'vitest';
import { scanBillingTicketImage } from '../server/billingScanner';

function jpegBuffer(): Buffer {
  const buffer = Buffer.alloc(64, 0);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return buffer;
}

function validTicket() {
  return {
    merchant: 'Comercio',
    issuerRfc: 'ABC010203AB1',
    date: '2026-08-15',
    time: '18:30',
    total: 125.5,
    subtotal: 108.19,
    iva: 17.31,
    currency: 'MXN',
    paymentMethod: 'Tarjeta',
    cardLast4: '1234',
    identifiers: [{ key: 'ticket', value: 'A-100' }],
    invoiceUrl: null,
    qrData: null,
    confidence: 0.95,
    warnings: [],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_BILLING_MODEL;
  delete process.env.OPENROUTER_RECEIPT_MODEL;
  delete process.env.OPENROUTER_RECEIPT_PAID_MODEL;
  delete process.env.OPENROUTER_RECEIPT_FALLBACK_MODEL;
});

describe('billing scanner', () => {
  it('uses Gemini Flash Lite before a configured free route', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_BILLING_MODEL = 'google/gemma-3-4b-it:free';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      choices: [{ message: { content: JSON.stringify(validTicket()) } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await scanBillingTicketImage(jpegBuffer(), 'image/jpeg');

    expect(result.total).toBe(125.5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.model).toBe('google/gemini-2.5-flash-lite');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.provider).toEqual({ allow_fallbacks: true, data_collection: 'deny' });
  });

  it('falls back to Gemini Flash after a model-specific 404', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: 'google/gemini-2.5-flash',
        choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(validTicket())}\n\`\`\`` } }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await scanBillingTicketImage(jpegBuffer(), 'image/jpeg');

    expect(result.merchant).toBe('Comercio');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(secondBody.model).toBe('google/gemini-2.5-flash');
  });

  it('stops immediately for account billing failures', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 402 } }), { status: 402 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(scanBillingTicketImage(jpegBuffer(), 'image/jpeg')).rejects.toMatchObject({
      status: 503,
      code: 'CONFIGURATION_ERROR',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
