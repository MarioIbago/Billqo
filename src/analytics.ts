import type {
  AiInsightsResponse,
  AnalyticsSummary,
  CategoryBudget,
  InsightItem,
  Transaction,
} from './types';

const EMPTY_ANALYTICS: AnalyticsSummary = {
  totalIncome: 0,
  totalExpenses: 0,
  netBalance: 0,
  savingsRate: null,
  averageDailyExpense: 0,
  expensesByCategory: [],
  weeklyExpenses: [],
  monthlyExpenses: [],
  averageInfluence: null,
  highInfluenceExpenses: 0,
  highInfluenceExpensePercentage: null,
  necessaryVsUnnecessary: { necessary: 0, unnecessary: 0 },
  fixedVsVariable: { fixed: 0, variable: 0 },
  currentPeriodExpenses: 0,
  previousPeriodExpenses: 0,
  percentageChange: null,
  projectedMonthExpense: null,
  projectedBalance: null,
};

function isoDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`;
}

function addUtcDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function firstDayOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function daysInclusive(from: string, to: string): number {
  const start = Date.parse(`${from}T12:00:00.000Z`);
  const end = Date.parse(`${to}T12:00:00.000Z`);
  return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
}

function total(items: Transaction[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

function inRange(transaction: Transaction, from: string, to: string): boolean {
  return transaction.date >= from && transaction.date <= to;
}

function isoWeek(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function groupAmount(items: Transaction[], keyOf: (transaction: Transaction) => string): Map<string, number> {
  const values = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    values.set(key, (values.get(key) ?? 0) + item.amount);
  }
  return values;
}

export function calculateAnalytics(
  transactions: Transaction[],
  budgets: CategoryBudget[] = [],
  options: { now?: Date; timezone?: string } = {},
): AnalyticsSummary {
  const timezone = options.timezone ?? 'America/Mexico_City';
  const today = isoDateInTimezone(options.now ?? new Date(), timezone);
  const active = transactions.filter((transaction) => !transaction.deletedAt);
  if (active.length === 0) return { ...EMPTY_ANALYTICS };

  const incomes = active.filter((transaction) => transaction.type === 'income');
  const expenses = active.filter((transaction) => transaction.type === 'expense');
  const totalIncome = total(incomes);
  const totalExpenses = total(expenses);
  const netBalance = totalIncome - totalExpenses;

  const expenseDays = new Set(expenses.map((transaction) => transaction.date));
  const byCategory = groupAmount(expenses, (transaction) => transaction.category || 'Sin categoría');
  const expensesByCategory = [...byCategory.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const weeklyExpenses = [...groupAmount(expenses, (transaction) => isoWeek(transaction.date)).entries()]
    .map(([week, amount]) => ({ week, amount }))
    .sort((a, b) => a.week.localeCompare(b.week));
  const monthlyExpenses = [...groupAmount(expenses, (transaction) => transaction.date.slice(0, 7)).entries()]
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const influencedExpenses = expenses.filter((transaction) => transaction.influence !== undefined);
  const averageInfluence = influencedExpenses.length > 0
    ? influencedExpenses.reduce((sum, transaction) => sum + (transaction.influence ?? 0), 0) / influencedExpenses.length
    : null;
  const highInfluence = influencedExpenses.filter((transaction) => (transaction.influence ?? 0) >= 4);
  const highInfluenceExpenses = total(highInfluence);
  const influenceByCategory = groupAmount(highInfluence, (transaction) => transaction.category || 'Sin categoría');
  const highestInfluenceCategory = [...influenceByCategory.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const necessaryVsUnnecessary = expenses.reduce(
    (result, transaction) => {
      if (transaction.necessity === 'Necesario') result.necessary += transaction.amount;
      if (transaction.necessity === 'Innecesario') result.unnecessary += transaction.amount;
      return result;
    },
    { necessary: 0, unnecessary: 0 },
  );
  const fixedVsVariable = expenses.reduce(
    (result, transaction) => {
      if (transaction.fixedVariable === 'Fijo') result.fixed += transaction.amount;
      if (transaction.fixedVariable === 'Variable') result.variable += transaction.amount;
      return result;
    },
    { fixed: 0, variable: 0 },
  );

  const currentStart = firstDayOfMonth(today);
  const elapsedDays = daysInclusive(currentStart, today);
  const previousStart = addUtcDays(currentStart, -elapsedDays);
  const previousEnd = addUtcDays(currentStart, -1);
  const currentExpenses = total(expenses.filter((transaction) => inRange(transaction, currentStart, today)));
  const previousExpenses = total(expenses.filter((transaction) => inRange(transaction, previousStart, previousEnd)));
  const currentIncome = total(incomes.filter((transaction) => inRange(transaction, currentStart, today)));
  const daysInMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
  const projectedMonthExpense = currentExpenses > 0 ? (currentExpenses / elapsedDays) * daysInMonth : null;
  return {
    totalIncome,
    totalExpenses,
    netBalance,
    savingsRate: totalIncome > 0 ? (netBalance / totalIncome) * 100 : null,
    averageDailyExpense: expenseDays.size > 0 ? totalExpenses / expenseDays.size : 0,
    expensesByCategory,
    weeklyExpenses,
    monthlyExpenses,
    averageInfluence,
    highInfluenceExpenses,
    highInfluenceExpensePercentage: totalExpenses > 0 ? (highInfluenceExpenses / totalExpenses) * 100 : null,
    highestInfluenceCategory,
    necessaryVsUnnecessary,
    fixedVsVariable,
    currentPeriodExpenses: currentExpenses,
    previousPeriodExpenses: previousExpenses,
    percentageChange: previousExpenses > 0 ? ((currentExpenses - previousExpenses) / previousExpenses) * 100 : null,
    projectedMonthExpense,
    projectedBalance: projectedMonthExpense === null ? null : currentIncome - projectedMonthExpense,
  };
}

export function buildDeterministicInsights(
  analytics: AnalyticsSummary,
  transactions: Transaction[],
): AiInsightsResponse {
  const activeExpenses = transactions.filter((transaction) => transaction.type === 'expense' && !transaction.deletedAt);
  if (activeExpenses.length === 0) {
    return {
      summary: 'Aún no hay movimientos suficientes para generar un resumen financiero.',
      insights: [{
        type: 'info',
        title: 'Tu historial está listo',
        description: 'Registra un ingreso o gasto para comenzar a ver métricas reales.',
      }],
      recommendations: ['Registra tu primer movimiento cuando lo tengas a la mano.'],
      isAiGenerated: false,
    };
  }

  const insights: InsightItem[] = [];
  const recommendations: string[] = [];
  const topCategory = analytics.expensesByCategory[0];

  if (analytics.percentageChange !== null) {
    const direction = analytics.percentageChange >= 0 ? 'más' : 'menos';
    insights.push({
      type: analytics.percentageChange > 15 ? 'warning' : 'info',
      title: 'Comparación del periodo',
      description: `Tus gastos del periodo actual son ${Math.abs(analytics.percentageChange).toFixed(1)}% ${direction} que en el periodo anterior equivalente.`,
    });
  }

  if (topCategory) {
    insights.push({
      type: 'info',
      title: 'Categoría principal',
      description: `${topCategory.category} concentra ${topCategory.percentage.toFixed(1)}% de tus gastos registrados.`,
    });
  }

  if (analytics.averageInfluence !== null) {
    insights.push({
      type: analytics.averageInfluence >= 4 ? 'warning' : 'info',
      title: 'Influencia al gastar',
      description: `La influencia media reportada en tus gastos es ${analytics.averageInfluence.toFixed(1)} de 5.`,
    });
  }

  const highInfluenceRecords = activeExpenses.filter((transaction) => (transaction.influence ?? 0) >= 4);
  if (activeExpenses.length >= 5 && highInfluenceRecords.length >= 3 && analytics.highInfluenceExpensePercentage !== null) {
    insights.push({
      type: analytics.highInfluenceExpensePercentage >= 30 ? 'warning' : 'info',
      title: 'Gastos con influencia alta',
      description: `${analytics.highInfluenceExpensePercentage.toFixed(1)}% del gasto registrado tiene una influencia de 4 o 5.`,
    });
    if (analytics.highestInfluenceCategory) {
      recommendations.push(`Podrías revisar un presupuesto específico para ${analytics.highestInfluenceCategory} si quieres tener más control sobre ese patrón.`);
    }
  } else {
    insights.push({
      type: 'info',
      title: 'Patrones de comportamiento',
      description: 'No hay suficientes movimientos para detectar este patrón con confianza.',
    });
  }

  if (analytics.savingsRate !== null) {
    recommendations.push(
      analytics.savingsRate >= 0
        ? 'Puedes revisar tu tasa de ahorro al cierre del periodo para decidir si deseas ajustar algún presupuesto.'
        : 'Podrías revisar las categorías que más pesan en este periodo y elegir una acción pequeña que te resulte cómoda.',
    );
  }

  return {
    summary: `Ingresos: $${analytics.totalIncome.toLocaleString('es-MX')}. Gastos: $${analytics.totalExpenses.toLocaleString('es-MX')}. Balance: $${analytics.netBalance.toLocaleString('es-MX')}.`,
    insights: insights.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
    isAiGenerated: false,
  };
}
