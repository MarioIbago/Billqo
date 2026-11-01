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


  it('subtracts an item coupon from the gross ticket total when the printed total is absent', () => {
    const raw = JSON.stringify({
      documentType: 'ticket',
      isFinancialDocument: true,
      movements: [{
        type: 'expense',
        merchant: 'Tienda',
        description: 'Compra de leche',
        amount: 100,
        currency: 'MXN',
        date: '2026-10-31',
        paymentMethod: 'Efectivo',
        category: 'Compras',
        costType: 'Variable',
        fixedVariable: 'Variable',
        necessity: 'Necesario',
        influence: 2,
        confidence: 0.94,
        warnings: [],
        receiptPricing: {
          preDiscountTotal: 100,
          couponDiscounts: [{ item: 'Leche', amount: 20 }],
          printedTotal: null,
        },
      }],
      warnings: [],
    });
    const result = parseFinancialDocumentModelResult(raw, ['Compras']);
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0].amount).toBe(80);
  });

  it('uses the paid total without applying a coupon twice', () => {
    const base = {
      documentType: 'ticket',
      isFinancialDocument: true,
      movements: [{
        type: 'expense',
        merchant: 'Tienda',
        description: 'Compra',
        amount: 85,
        currency: 'MXN',
        date: '2026-10-31',
        paymentMethod: 'Efectivo',
        category: 'Compras',
        costType: 'Variable',
        fixedVariable: 'Variable',
        necessity: 'Necesario',
        influence: 2,
        confidence: 0.9,
        warnings: [],
        receiptPricing: {
          preDiscountTotal: 100,
          couponDiscounts: [{ item: 'Arroz', amount: 15 }],
          printedTotal: 85,
        },
      }],
      warnings: [],
    };
    expect(parseFinancialDocumentModelResult(JSON.stringify(base), ['Compras']).movements[0].amount).toBe(85);
    base.movements[0].amount = 100;
    expect(parseFinancialDocumentModelResult(JSON.stringify(base), ['Compras']).movements[0].amount).toBe(85);
  });

  it('never blindly subtracts a coupon from an unverified net amount', () => {
    const raw = JSON.stringify({
      documentType: 'ticket',
      isFinancialDocument: true,
      movements: [{
        type: 'expense',
        merchant: 'Tienda',
        description: 'Compra',
        amount: 85,
        currency: 'MXN',
        date: '2026-10-31',
        paymentMethod: 'Efectivo',
        category: 'Compras',
        costType: 'Variable',
        fixedVariable: 'Variable',
        necessity: 'Necesario',
        influence: 2,
        confidence: 0.9,
        warnings: [],
        receiptPricing: {
          preDiscountTotal: null,
          couponDiscounts: [{ item: 'Arroz', amount: 15 }],
          printedTotal: null,
        },
      }],
      warnings: [],
    });
    expect(parseFinancialDocumentModelResult(raw, ['Compras']).movements[0].amount).toBe(85);
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
