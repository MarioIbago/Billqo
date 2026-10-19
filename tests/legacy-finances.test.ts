import { describe, expect, it } from 'vitest';
import { parseOptionalFinanceSheets } from '../server/legacyFinances';

const opening = [
  ['id_cuenta', 'grupo', 'cuenta', 'titular_entidad', 'moneda', 'saldo_inicial', 'entradas_posteriores', 'salidas_posteriores', 'saldo_actual_corte', 'tipo_cambio_mxn', 'equivalente_mxn', 'estado', 'observaciones', 'fecha_corte', 'es_ingreso'],
  ['cash-01', 'Efectivo', 'Cartera ficticia', 'Persona', 'MXN', 100, 0, 0, 100, 1, 100, 'Contado', '', '2026-10-18', false],
  ['foreign-01', 'Divisas', 'Dólares ficticios', 'Persona', 'USD', 10, 0, 0, 10, 20, 200, 'Contado', '', '2026-10-18', false],
];
const historical = [
  ['id_evento', 'fecha_real', 'tipo_evento', 'descripcion', 'negocio', 'cuenta_identificada', 'canal', 'flujo_mxn', 'unidades', 'estado', 'fuente', 'notas', 'ya_reflejado_en_corte', 'registrar_como_movimiento_nuevo'],
  ['sample-1', '2026-08-01', 'Venta', 'Venta de muestra', 'Negocio ficticio', 'test', 'Efectivo', 70, -1, 'Conciliado', 'test', '', true, false],
  ['sample-2', 'SIN FECHA EXACTA', 'Regalo', 'Muestra', 'Negocio ficticio', '', 'No monetario', 0, -1, 'Declarado', 'test', '', true, false],
];

describe('opt-in financial history migration', () => {
  it('leaves old and new sheets without optional tabs unchanged', () => {
    expect(parseOptionalFinanceSheets()).toEqual({ openingBalances: [], historicalBusinessEvents: [], issues: [] });
  });
  it('reads opening positions in MXN without treating them as transactions', () => {
    const output = parseOptionalFinanceSheets(opening, historical);
    expect(output.issues).toEqual([]);
    expect(output.openingBalances).toHaveLength(2);
    expect(output.openingBalances.reduce((sum, row) => sum + row.equivalentMXN, 0)).toBe(300);
    expect(output.historicalBusinessEvents).toHaveLength(2);
    expect(output.historicalBusinessEvents[0]?.cashFlowMXN).toBe(70);
    expect(output.historicalBusinessEvents[1]?.date).toBeNull();
  });
  it('does not double count duplicate accounts or accept incorrect FX equivalents', () => {
    const rows = [...opening, [...opening[1]], ['bad', 'Divisas', 'FX mal registrado', '', 'USD', 10, 0, 0, 10, 20, 250, '', '', '2026-10-18', false]];
    const output = parseOptionalFinanceSheets(rows);
    expect(output.openingBalances).toHaveLength(2);
    expect(output.issues).toHaveLength(2);
  });
  it('rejects malformed optional headers without throwing or disrupting ordinary financial views', () => {
    const output = parseOptionalFinanceSheets([['incorrecta'], ['x']], [['incorrecta'], ['x']]);
    expect(output.openingBalances).toEqual([]);
    expect(output.historicalBusinessEvents).toEqual([]);
    expect(output.issues).toHaveLength(2);
  });
  it('excludes historical rows not confirmed as included in the opening cutoff', () => {
    const draft = [...historical[1]];
    draft[0] = 'uncertain';
    draft[12] = false;
    const output = parseOptionalFinanceSheets([], [...historical, draft]);
    expect(output.historicalBusinessEvents).toHaveLength(2);
    expect(output.issues).toHaveLength(1);
  });
});
