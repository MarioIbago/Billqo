import { DEFAULT_CATEGORIES } from '../src/types';

export const SHEET_SCHEMA_VERSION = 1;

export const SHEET_NAMES = {
  transactions: 'MOVIMIENTOS',
  categories: 'CATEGORÍAS',
  budgets: 'PRESUPUESTOS',
  recurrences: 'RECURRENTES',
  configuration: 'CONFIGURACIÓN',
} as const;

export const MOVEMENT_HEADERS = [
  'id',
  'fecha',
  'tipo',
  'monto',
  'descripcion',
  'categoria_id',
  'categoria',
  'metodo_pago',
  'cuenta',
  'clasificacion_costo',
  'fijo_variable',
  'necesario_innecesario',
  'influencia',
  'notas',
  'tags',
  'recurrente_id',
  'created_at',
  'updated_at',
  'deleted_at',
] as const;

export const CATEGORY_HEADERS = [
  'id',
  'nombre',
  'tipo',
  'icono',
  'activo',
  'created_at',
  'updated_at',
] as const;

export const BUDGET_HEADERS = [
  'id',
  'categoria_id',
  'monto_limite',
  'periodo',
  'fecha_inicio',
  'fecha_fin',
  'activo',
  'created_at',
  'updated_at',
  'deleted_at',
] as const;

export const RECURRENCE_HEADERS = [
  'id',
  'tipo',
  'descripcion',
  'categoria_id',
  'categoria',
  'monto',
  'frecuencia',
  'proxima_fecha',
  'activo',
  'created_at',
  'updated_at',
  'deleted_at',
] as const;

export const CONFIGURATION_HEADERS = ['clave', 'valor', 'updated_at'] as const;

export const INITIAL_CONFIGURATION: ReadonlyArray<readonly [string, string | number]> = [
  ['moneda', 'MXN'],
  ['formato_fecha', 'DD/MM/YYYY'],
  ['timezone', 'America/Mexico_City'],
  ['presupuesto_mensual_total', 0],
  ['version_schema', SHEET_SCHEMA_VERSION],
];

export function initialCategoryRows(now: string): Array<Array<string | boolean>> {
  return DEFAULT_CATEGORIES.map((category) => [
    category.id,
    category.name,
    category.type === 'income' ? 'Ingreso' : 'Gasto',
    category.icon,
    category.active,
    now,
    now,
  ]);
}

export function a1(sheetName: string, range: string): string {
  return `'${sheetName.replace(/'/g, "''")}'!${range}`;
}
