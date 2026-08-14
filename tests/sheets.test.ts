import { describe, expect, it } from 'vitest';
import { categorySeedRange, isRetryableGoogleReadError, parseTransactionRows, recurrenceIdForTransaction } from '../server/sheets';
import { INITIAL_CONFIGURATION, MOVEMENT_HEADERS, SHEET_NAMES, initialCategoryRows } from '../server/sheetsSchema';
import type { Category } from '../src/types';

const categories: Category[] = [{ id: 'comida', name: 'Comida', type: 'expense', icon: 'utensils', active: true, createdAt: '2026-08-01T00:00:00.000Z' }];
const validRow = ['tx-1', '2026-08-10', 'Gasto', 450, 'Cena', 'comida', 'Comida', 'Tarjeta Crédito', '', 'Discrecional', 'Variable', 'Innecesario', 4, '', '', '', '2026-08-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z', ''];

describe('Google Sheets schema and row conversion', () => {
  it('uses the required Spanish tab and movement column names', () => {
    expect(SHEET_NAMES.transactions).toBe('MOVIMIENTOS');
    expect(MOVEMENT_HEADERS).toEqual([
      'id', 'fecha', 'tipo', 'monto', 'descripcion', 'categoria_id', 'categoria', 'metodo_pago', 'cuenta', 'clasificacion_costo', 'fijo_variable', 'necesario_innecesario', 'influencia', 'notas', 'tags', 'recurrente_id', 'created_at', 'updated_at', 'deleted_at',
    ]);
    expect(initialCategoryRows('2026-08-01T00:00:00.000Z').some((row) => row[1] === 'Comida')).toBe(true);
    expect(INITIAL_CONFIGURATION).toContainEqual(['presupuesto_mensual_total', 0]);
  });

  it('creates a category payload range large enough for the full initial catalogue', () => {
    const rows = initialCategoryRows('2026-08-01T00:00:00.000Z');
    expect(rows.length).toBeGreaterThan(0);
    expect(categorySeedRange(rows.length)).toBe(`A1:G${rows.length + 1}`);
    expect(() => categorySeedRange(0)).toThrow('initial category catalogue');
  });

  it('excludes invalid rows and every duplicated id while preserving row numbers', () => {
    const invalidDate = [...validRow];
    invalidDate[0] = 'bad-date';
    invalidDate[1] = '10/08/2026';
    const duplicate = [...validRow];
    const result = parseTransactionRows([Array.from(MOVEMENT_HEADERS), validRow, duplicate, invalidDate], categories);

    expect(result.transactions).toEqual([]);
    expect(result.issues.some((issue) => issue.row === 2 && issue.message.includes('duplicado'))).toBe(true);
    expect(result.issues.some((issue) => issue.row === 3 && issue.message.includes('duplicado'))).toBe(true);
    expect(result.issues).toContainEqual(expect.objectContaining({ row: 4, field: 'fecha' }));
  });

  it('excludes a row whose UTC version marker was manually corrupted', () => {
    const corruptedTimestamp = [...validRow];
    corruptedTimestamp[17] = 'ayer';
    const result = parseTransactionRows([Array.from(MOVEMENT_HEADERS), corruptedTimestamp], categories);

    expect(result.transactions).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ row: 2, field: 'updated_at' }));
  });

  it('derives recurring IDs from the idempotent movement ID', () => {
    expect(recurrenceIdForTransaction('movement-123')).toBe('recurrence-movement-123');
    expect(recurrenceIdForTransaction('movement-123')).toBe(recurrenceIdForTransaction('movement-123'));
  });

  it('retries only transient Google read failures', () => {
    expect(isRetryableGoogleReadError({ response: { status: 429 } })).toBe(true);
    expect(isRetryableGoogleReadError({ response: { status: 503 } })).toBe(true);
    expect(isRetryableGoogleReadError({ code: 'ECONNRESET' })).toBe(true);
    expect(isRetryableGoogleReadError({ response: { status: 400 } })).toBe(false);
    expect(isRetryableGoogleReadError({ response: { status: 401 } })).toBe(false);
    expect(isRetryableGoogleReadError({ response: { status: 403 } })).toBe(false);
  });
});
