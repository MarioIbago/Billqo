import { describe, expect, it } from 'vitest';
import { parseFinancialDocumentModelResult } from '../server/receiptScannerV2';

describe('financial document scanner', () => {
  it('keeps bank statement movements separate', () => {
    const raw = JSON.stringify({
      documentType: 'bank_statement',
      isFinancialDocument: true,
      warnings: [],
      movements: [
        {
          type: 'expense',
          merchant: 'UBER',
          description: 'Viaje Uber',
          amount: 187,
          currency: 'MXN',
          date: '2026-08-20',
          paymentMethod: null,
          category: 'Transporte',
          costType: 'Variable',
          fixedVariable: 'Variable',
          necessity: 'Necesario',
          influence: 2,
          confidence: 0.94,
          warnings: [],
        },
        {
          type: 'income',
          merchant: null,
          description: 'Transferencia recibida',
          amount: 1500,
          currency: 'MXN',
          date: '2026-08-21',
          paymentMethod: 'Transferencia',
          category: 'Otros',
          costType: 'Ingreso',
          fixedVariable: null,
          necessity: null,
          influence: null,
          confidence: 0.91,
          warnings: [],
        },
      ],
    });

    const result = parseFinancialDocumentModelResult(raw, ['Transporte', 'Otros']);

    expect(result.documentType).toBe('bank_statement');
    expect(result.movements).toHaveLength(2);
    expect(result.movements[0]).toMatchObject({ type: 'expense', amount: 187, description: 'Viaje Uber' });
    expect(result.movements[1]).toMatchObject({ type: 'income', amount: 1500, description: 'Transferencia recibida' });
  });

  it('normalizes negative statement amounts without combining them', () => {
    const raw = JSON.stringify({
      documentType: 'bank_movements',
      isFinancialDocument: true,
      movements: [
        {
          type: 'expense',
          description: 'Compra',
          amount: '-95.50',
          currency: 'MXN',
          date: '2026-08-22',
          paymentMethod: 'Tarjeta Débito',
          category: 'Compras',
          confidence: 0.9,
          warnings: [],
        },
      ],
      warnings: [],
    });

    const result = parseFinancialDocumentModelResult(raw, ['Compras']);
    expect(result.movements[0].amount).toBe(95.5);
  });

  it('rejects a document explicitly classified as non financial', () => {
    const raw = JSON.stringify({
      documentType: 'other',
      isFinancialDocument: false,
      movements: [],
      warnings: [],
    });

    expect(() => parseFinancialDocumentModelResult(raw, [])).toThrow(/no parece ser/i);
  });
});
