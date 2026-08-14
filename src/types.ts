export type TransactionType = 'income' | 'expense';

export type CostType =
  | 'Fijo'
  | 'Variable'
  | 'Discrecional'
  | 'Operativo'
  | 'Hormiga'
  | 'Ingreso';

export type FixedVariable = 'Fijo' | 'Variable';
export type Necessity = 'Necesario' | 'Innecesario';
export type PaymentMethod = 'Efectivo' | 'Tarjeta Débito' | 'Tarjeta Crédito' | 'Transferencia';
export type TransactionCategory = string;

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const DEFAULT_CATEGORIES: ReadonlyArray<Omit<Category, 'createdAt' | 'updatedAt'>> = [
  { id: 'comida', name: 'Comida', type: 'expense', icon: 'utensils', active: true },
  { id: 'restaurantes', name: 'Restaurantes', type: 'expense', icon: 'coffee', active: true },
  { id: 'transporte', name: 'Transporte', type: 'expense', icon: 'bus', active: true },
  { id: 'gasolina', name: 'Gasolina', type: 'expense', icon: 'fuel', active: true },
  { id: 'renta', name: 'Renta', type: 'expense', icon: 'home', active: true },
  { id: 'servicios', name: 'Servicios', type: 'expense', icon: 'plug', active: true },
  { id: 'educacion', name: 'Educación', type: 'expense', icon: 'graduation-cap', active: true },
  { id: 'salud', name: 'Salud', type: 'expense', icon: 'heart-pulse', active: true },
  { id: 'entretenimiento', name: 'Entretenimiento', type: 'expense', icon: 'film', active: true },
  { id: 'compras', name: 'Compras', type: 'expense', icon: 'shopping-bag', active: true },
  { id: 'suscripciones', name: 'Suscripciones', type: 'expense', icon: 'repeat-2', active: true },
  { id: 'viajes', name: 'Viajes', type: 'expense', icon: 'plane', active: true },
  { id: 'negocio-gasto', name: 'Negocio', type: 'expense', icon: 'briefcase-business', active: true },
  { id: 'impuestos', name: 'Impuestos', type: 'expense', icon: 'receipt', active: true },
  { id: 'otros-gastos', name: 'Otros', type: 'expense', icon: 'circle-ellipsis', active: true },
  { id: 'sueldo', name: 'Sueldo', type: 'income', icon: 'badge-dollar-sign', active: true },
  { id: 'ventas', name: 'Ventas', type: 'income', icon: 'store', active: true },
  { id: 'freelance', name: 'Freelance', type: 'income', icon: 'laptop', active: true },
  { id: 'negocio-ingreso', name: 'Negocio', type: 'income', icon: 'briefcase-business', active: true },
  { id: 'inversiones', name: 'Inversiones', type: 'income', icon: 'chart-line', active: true },
  { id: 'reembolsos', name: 'Reembolsos', type: 'income', icon: 'rotate-ccw', active: true },
  { id: 'otros-ingresos', name: 'Otros', type: 'income', icon: 'circle-ellipsis', active: true },
];

export interface FinancialTransaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId?: string;
  category: TransactionCategory;
  costType: CostType;
  fixedVariable?: FixedVariable;
  necessity?: Necessity;
  influence?: 1 | 2 | 3 | 4 | 5;
  date: string;
  paymentMethod: PaymentMethod;
  account?: string;
  notes?: string;
  tags?: string[];
  recurring?: boolean;
  recurringId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// Preserves the existing component-facing name while adding the new data model.
export type Transaction = FinancialTransaction;

export interface CategoryBudget {
  id: string;
  categoryId?: string;
  category: TransactionCategory;
  allocatedAmount: number;
  spentAmount: number;
  period?: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface RecurringTransaction {
  id: string;
  type: TransactionType;
  description: string;
  categoryId?: string;
  category: string;
  amount: number;
  frequency: string;
  nextDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface FinancialPreferences {
  currency: string;
  dateFormat: string;
  timezone: string;
  monthlyBudget: number;
  schemaVersion: number;
  updatedAt?: string;
}

export type GoogleConnectionStatus =
  | 'not_connected'
  | 'authorized'
  | 'provisioning'
  | 'connected'
  | 'reauth_required'
  | 'file_missing'
  | 'error';

export interface GoogleConnection {
  status: GoogleConnectionStatus;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  schemaVersion?: number;
  lastSyncAt?: string;
  message?: string;
}

export interface ValidationIssue {
  sheet: string;
  row: number;
  field?: string;
  message: string;
}

export interface AnalyticsSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  savingsRate: number | null;
  averageDailyExpense: number;
  expensesByCategory: Array<{ category: string; amount: number; percentage: number }>;
  weeklyExpenses: Array<{ week: string; amount: number }>;
  monthlyExpenses: Array<{ month: string; amount: number }>;
  averageInfluence: number | null;
  highInfluenceExpenses: number;
  highInfluenceExpensePercentage: number | null;
  highestInfluenceCategory?: string;
  necessaryVsUnnecessary: { necessary: number; unnecessary: number };
  fixedVsVariable: { fixed: number; variable: number };
  currentPeriodExpenses: number;
  previousPeriodExpenses: number;
  percentageChange: number | null;
  projectedMonthExpense: number | null;
  projectedBalance: number | null;
}

export interface InsightItem {
  type: 'positive' | 'warning' | 'alert' | 'info';
  title: string;
  description: string;
}

export interface AiInsightsResponse {
  summary: string;
  insights: InsightItem[];
  recommendations: string[];
  isAiGenerated: boolean;
}

export interface FinancialSnapshot {
  transactions: Transaction[];
  categories: Category[];
  budgets: CategoryBudget[];
  recurrences: RecurringTransaction[];
  preferences: FinancialPreferences;
  analytics: AnalyticsSummary;
  validationIssues: ValidationIssue[];
  syncedAt: string;
}

export interface ApiError {
  code:
    | 'AUTH_REQUIRED'
    | 'GOOGLE_REAUTH_REQUIRED'
    | 'SHEET_NOT_FOUND'
    | 'SHEET_SCHEMA_INVALID'
    | 'VALIDATION_FAILED'
    | 'CONFLICT'
    | 'RATE_LIMITED'
    | 'CONFIGURATION_ERROR'
    | 'GOOGLE_ERROR'
    | 'INTERNAL';
  message: string;
  recoverable?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  currency: string;
  monthlyBudget: number;
}
