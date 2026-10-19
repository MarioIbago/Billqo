import type { HistoricalBusinessEvent, OpeningBalance, ValidationIssue } from '../src/types';

export type OptionalCell = string | number | boolean | null | undefined;
export type OptionalRows = OptionalCell[][];

export const OPENING_BALANCES_TAB = 'SALDOS_INICIALES';
export const HISTORICAL_EVENTS_TAB = 'HISTORIAL_CONTABLE';
export const OPENING_BALANCES_CONFIG_KEY = 'fuente_patrimonial';

function value(cell: OptionalCell): string {
  return cell === null || cell === undefined ? '' : String(cell).trim();
}

function finite(cell: OptionalCell): number | undefined {
  if (cell === '' || cell === null || cell === undefined || typeof cell === 'boolean') return undefined;
  const number = typeof cell === 'number' ? cell : Number(value(cell).replace(/[$,\\s]/g, ''));
  return Number.isFinite(number) ? number : undefined;
}

function headerIndex(rows: OptionalRows, sheet: string, required: string[], issues: ValidationIssue[]): Map<string, number> | undefined {
  if (rows.length === 0) return undefined;
  const columns = new Map((rows[0] ?? []).map((cell, index) => [value(cell), index]));
  const missing = required.filter(name => !columns.has(name));
  if (missing.length) {
    issues.push({ sheet, row: 1, message: `Faltan encabezados: ${missing.join(', ')}. Se omitió esta sección opcional.` });
    return undefined;
  }
  return columns;
}

function get(row: OptionalCell[], headers: Map<string, number>, field: string): OptionalCell {
  return row[headers.get(field) ?? -1];
}

export interface OptionalFinanceResult {
  openingBalances: OpeningBalance[];
  historicalBusinessEvents: HistoricalBusinessEvent[];
  issues: ValidationIssue[];
}

/** Finances before the cutoff stay separate from POST-cutoff MOVIMIENTOS and analytics. */
export function parseOptionalFinanceSheets(openingRows: OptionalRows = [], historyRows: OptionalRows = []): OptionalFinanceResult {
  const issues: ValidationIssue[] = [];
  const openingBalances: OpeningBalance[] = [];
  const historicalBusinessEvents: HistoricalBusinessEvent[] = [];

  const openingHeaders = headerIndex(openingRows, OPENING_BALANCES_TAB,
    ['id_cuenta', 'grupo', 'cuenta', 'moneda', 'saldo_inicial', 'tipo_cambio_mxn', 'equivalente_mxn', 'fecha_corte'], issues);
  if (openingHeaders) {
    const seen = new Set<string>();
    for (let i = 1; i < openingRows.length; i++) {
      const row = openingRows[i] ?? [];
      if (row.every(cell => value(cell) === '')) continue;
      const id = value(get(row, openingHeaders, 'id_cuenta'));
      const group = value(get(row, openingHeaders, 'grupo'));
      const account = value(get(row, openingHeaders, 'cuenta'));
      const currency = value(get(row, openingHeaders, 'moneda')).toUpperCase();
      const amount = finite(get(row, openingHeaders, 'saldo_inicial'));
      const exchangeRateMXN = finite(get(row, openingHeaders, 'tipo_cambio_mxn'));
      const equivalentMXN = finite(get(row, openingHeaders, 'equivalente_mxn'));
      const cutoffDate = value(get(row, openingHeaders, 'fecha_corte'));
      if (!id || !account || !group || !/^[A-Z]{3}$/.test(currency) ||
        amount === undefined || exchangeRateMXN === undefined || exchangeRateMXN <= 0 ||
        equivalentMXN === undefined || !/^\\d{4}-\\d{2}-\\d{2}$/.test(cutoffDate) ||
        Number.isNaN(Date.parse(cutoffDate))) {
        issues.push({ sheet: OPENING_BALANCES_TAB, row: i + 1, message: 'Saldo inicial incompleto o inválido; no se contabilizó.' });
        continue;
      }
      if (seen.has(id)) {
        issues.push({ sheet: OPENING_BALANCES_TAB, row: i + 1, field: 'id_cuenta', message: 'ID de cuenta duplicado; no se contabilizó.' });
        continue;
      }
      if (Math.abs(amount * exchangeRateMXN - equivalentMXN) > 0.03) {
        issues.push({ sheet: OPENING_BALANCES_TAB, row: i + 1, field: 'equivalente_mxn', message: 'El equivalente MXN no coincide con monto × tipo de cambio; verificar antes de incluirlo.' });
        continue;
      }
      seen.add(id);
      openingBalances.push({
        id, group, account,
        entity: value(get(row, openingHeaders, 'titular_entidad')),
        currency, amount, exchangeRateMXN, equivalentMXN, cutoffDate,
        notes: value(get(row, openingHeaders, 'observaciones')),
      });
    }
  }

  const historyHeaders = headerIndex(historyRows, HISTORICAL_EVENTS_TAB,
    ['id_evento', 'fecha_real', 'tipo_evento', 'descripcion', 'negocio', 'flujo_mxn', 'ya_reflejado_en_corte'], issues);
  if (historyHeaders) {
    const seen = new Set<string>();
    for (let i = 1; i < historyRows.length; i++) {
      const row = historyRows[i] ?? [];
      if (row.every(cell => value(cell) === '')) continue;
      const id = value(get(row, historyHeaders, 'id_evento'));
      const amount = finite(get(row, historyHeaders, 'flujo_mxn'));
      const included = value(get(row, historyHeaders, 'ya_reflejado_en_corte')).toLowerCase();
      if (!id || seen.has(id) || amount === undefined || !['true', 'sí', 'si'].includes(included)) {
        issues.push({ sheet: HISTORICAL_EVENTS_TAB, row: i + 1, message: 'Registro histórico inválido, duplicado o sin confirmación del corte; se omitió.' });
        continue;
      }
      seen.add(id);
      const rawDate = value(get(row, historyHeaders, 'fecha_real'));
      const date = /^\\d{4}-\\d{2}-\\d{2}$/.test(rawDate) && !Number.isNaN(Date.parse(rawDate)) ? rawDate : null;
      historicalBusinessEvents.push({
        id, date,
        type: value(get(row, historyHeaders, 'tipo_evento')),
        description: value(get(row, historyHeaders, 'descripcion')),
        business: value(get(row, historyHeaders, 'negocio')),
        account: value(get(row, historyHeaders, 'cuenta_identificada')),
        channel: value(get(row, historyHeaders, 'canal')),
        cashFlowMXN: amount,
        units: finite(get(row, historyHeaders, 'unidades')) ?? 0,
        source: value(get(row, historyHeaders, 'fuente')),
        notes: value(get(row, historyHeaders, 'notas')),
        includedInOpeningBalance: true,
      });
    }
  }
  return { openingBalances, historicalBusinessEvents, issues };
}
