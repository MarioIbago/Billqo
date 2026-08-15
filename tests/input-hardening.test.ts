import { describe, expect, it } from 'vitest';
import {
  MAX_TRANSACTION_TEXT_LENGTH,
  preferencePayloadIssue,
  transactionPayloadIssue,
} from '../server/inputHardening';

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    type: 'expense',
    amount: 150.25,
    description: 'Supermercado',
    categoryId: 'comida',
    category: 'Comida',
    costType: 'Variable',
    fixedVariable: 'Variable',
    necessity: 'Necesario',
    influence: 2,
    date: '2026-08-15',
    paymentMethod: 'Tarjeta Débito',
    notes: 'Compra semanal',
    recurring: false,
    ...overrides,
  };
}

describe('transaction input hardening', () => {
  it('accepts a normal transaction', () => {
    expect(transactionPayloadIssue(transaction())).toBeUndefined();
  });

  it('rejects descriptions and notes longer than 200 characters', () => {
    expect(transactionPayloadIssue(transaction({ description: 'x'.repeat(MAX_TRANSACTION_TEXT_LENGTH + 1) }))).toMatch(/200 caracteres/i);
    expect(transactionPayloadIssue(transaction({ notes: 'x'.repeat(MAX_TRANSACTION_TEXT_LENGTH + 1) }))).toMatch(/200 caracteres/i);
  });

  it('rejects hostile control characters and multiline descriptions', () => {
    expect(transactionPayloadIssue(transaction({ description: 'Pago\u0000oculto' }))).toMatch(/caracteres no permitidos/i);
    expect(transactionPayloadIssue(transaction({ description: 'Pago\ninyectado' }))).toMatch(/una sola línea/i);
  });

  it('requires a real numeric amount instead of coercing arbitrary strings', () => {
    expect(transactionPayloadIssue(transaction({ amount: '150.25' }))).toMatch(/monto debe ser un número/i);
    expect(transactionPayloadIssue(transaction({ amount: Number.POSITIVE_INFINITY }))).toMatch(/monto debe ser un número/i);
  });

  it('rejects malformed dates before they reach the Sheet writer', () => {
    expect(transactionPayloadIssue(transaction({ date: '2026-99-99' }))).toMatch(/fecha no tiene un formato válido/i);
  });
});

describe('preference input hardening', () => {
  const version = '2026-08-15T18:00:00.000Z';

  it('accepts typed financial preferences', () => {
    expect(preferencePayloadIssue({
      expectedUpdatedAt: version,
      currency: 'MXN',
      dateFormat: 'DD/MM/YYYY',
      timezone: 'America/Mexico_City',
      monthlyBudget: 5000,
    })).toBeUndefined();
  });

  it('rejects arbitrary currency, timezone and budget values', () => {
    expect(preferencePayloadIssue({ expectedUpdatedAt: version, currency: '<script>' })).toMatch(/moneda/i);
    expect(preferencePayloadIssue({ expectedUpdatedAt: version, timezone: 'not/a-zone' })).toMatch(/zona horaria/i);
    expect(preferencePayloadIssue({ expectedUpdatedAt: version, monthlyBudget: '5000' })).toMatch(/presupuesto mensual/i);
  });

  it('rejects unknown configuration fields', () => {
    expect(preferencePayloadIssue({ expectedUpdatedAt: version, injected: 'value' })).toMatch(/campos no permitidos/i);
  });
});