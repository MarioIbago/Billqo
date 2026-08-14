import { describe, expect, it } from 'vitest';
import { buildDeterministicInsights, calculateAnalytics } from '../src/analytics';
import type { Transaction } from '../src/types';

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? `tx-${Math.random()}`,
    description: overrides.description ?? 'Movimiento',
    amount: overrides.amount ?? 100,
    type: overrides.type ?? 'expense',
    category: overrides.category ?? 'Comida',
    categoryId: overrides.categoryId ?? 'comida',
    costType: overrides.costType ?? (overrides.type === 'income' ? 'Ingreso' : 'Variable'),
    fixedVariable: overrides.type === 'income' ? undefined : overrides.fixedVariable ?? 'Variable',
    necessity: overrides.type === 'income' ? undefined : overrides.necessity ?? 'Necesario',
    influence: overrides.type === 'income' ? undefined : overrides.influence ?? 3,
    date: overrides.date ?? '2026-08-05',
    paymentMethod: overrides.paymentMethod ?? 'Tarjeta Débito',
    createdAt: overrides.createdAt ?? '2026-08-05T12:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-08-05T12:00:00.000Z',
    ...overrides,
  };
}

describe('calculateAnalytics', () => {
  it('uses active normalized rows and never invents a rate without income', () => {
    const result = calculateAnalytics([
      transaction({ id: 'income', type: 'income', amount: 1_000, costType: 'Ingreso', category: 'Sueldo', categoryId: 'sueldo', date: '2026-08-01' }),
      transaction({ id: 'food', amount: 450, category: 'Comida', date: '2026-08-02', influence: 4 }),
      transaction({ id: 'rent', amount: 300, category: 'Renta', categoryId: 'renta', date: '2026-08-03', fixedVariable: 'Fijo' }),
      transaction({ id: 'deleted', amount: 900, deletedAt: '2026-08-04T00:00:00.000Z' }),
    ], [], { now: new Date('2026-08-10T18:00:00.000Z'), timezone: 'America/Mexico_City' });

    expect(result.totalIncome).toBe(1_000);
    expect(result.totalExpenses).toBe(750);
    expect(result.netBalance).toBe(250);
    expect(result.savingsRate).toBe(25);
    expect(result.expensesByCategory.map((item) => item.category)).toEqual(['Comida', 'Renta']);
    expect(result.averageInfluence).toBe(3.5);
  });

  it('returns explicit insufficient-data content for behavioral patterns', () => {
    const transactions = [
      transaction({ id: 'a', amount: 10 }),
      transaction({ id: 'b', amount: 20, date: '2026-08-06' }),
      transaction({ id: 'c', amount: 30, date: '2026-08-07' }),
    ];
    const analytics = calculateAnalytics(transactions, [], { now: new Date('2026-08-10T18:00:00.000Z') });
    const response = buildDeterministicInsights(analytics, transactions);

    expect(response.isAiGenerated).toBe(false);
    expect(response.insights.some((insight) => insight.title === 'Patrones de comportamiento' && insight.description.includes('No hay suficientes'))).toBe(true);
  });

  it('handles an empty Sheet without fabricated totals', () => {
    const result = calculateAnalytics([], []);
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(0);
    expect(result.savingsRate).toBeNull();
    expect(result.projectedMonthExpense).toBeNull();
  });
});
