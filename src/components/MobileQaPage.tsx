import React, { useState } from 'react';
import type { FinancialSnapshot } from '../types';
import { BillingWorkspace } from './BillingWorkspace';
import { CrystalWorkspace, type CrystalView } from './CrystalWorkspace';

const snapshot: FinancialSnapshot = {
  transactions: [],
  categories: [
    { id: 'comida', name: 'Comida', type: 'expense', icon: 'utensils', active: true, createdAt: '2026-08-15T00:00:00.000Z' },
    { id: 'transporte', name: 'Transporte', type: 'expense', icon: 'bus', active: true, createdAt: '2026-08-15T00:00:00.000Z' },
  ],
  budgets: [],
  recurrences: [],
  preferences: { currency: 'MXN', dateFormat: 'dd/MM/yyyy', timezone: 'America/Monterrey', monthlyBudget: 0, schemaVersion: 1 },
  analytics: {
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
  },
  validationIssues: [],
  syncedAt: '2026-08-15T00:00:00.000Z',
};

export function MobileQaPage() {
  const [billing, setBilling] = useState(() => new URLSearchParams(window.location.search).get('view') === 'billing');
  const [view, setView] = useState<CrystalView>('movements');

  if (billing) return <BillingWorkspace onBack={() => setBilling(false)} />;

  return (
    <CrystalWorkspace
      snapshot={snapshot}
      connection={{ status: 'connected', spreadsheetId: 'qa' }}
      user={{ id: 'qa', name: 'Mario', email: 'qa@billqo.app', avatar: '' }}
      activeView={view}
      onViewChange={setView}
      onOpenAdd={() => undefined}
      onOpenBilling={() => setBilling(true)}
      onEditTransaction={() => undefined}
      onDeleteTransaction={() => undefined}
      onDeleteAllTransactions={() => undefined}
      onDeleteFinancialData={() => undefined}
      onSaveBudget={async () => undefined}
      onSavePreferences={async () => undefined}
      onRefresh={async () => undefined}
      onReconnect={() => undefined}
      onDisconnect={() => undefined}
      onSignOut={() => undefined}
      busy={false}
    />
  );
}
