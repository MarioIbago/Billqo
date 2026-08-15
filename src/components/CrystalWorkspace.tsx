import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  FileJson,
  FileSpreadsheet,
  Filter,
  Home,
  Layers3,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  WalletCards,
  X,
} from 'lucide-react';
import { buildDeterministicInsights, calculateAnalytics } from '../analytics';
import type { FinancialSnapshot, GoogleConnection, Transaction, TransactionType } from '../types';
import { CuantlyMark } from './CuantlyBrand';

export type CrystalView = 'dashboard' | 'movements' | 'insights' | 'budgets' | 'categories' | 'settings' | 'export' | 'privacy';

interface CrystalProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface CrystalWorkspaceProps {
  snapshot: FinancialSnapshot;
  connection: GoogleConnection;
  user: CrystalProfile;
  activeView: CrystalView;
  onViewChange: (view: CrystalView) => void;
  onOpenAdd: () => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transaction: Transaction) => void;
  onDeleteAllTransactions: () => void;
  onDeleteFinancialData: () => void;
  onSaveBudget: (categoryId: string, amount: number) => Promise<void>;
  onSavePreferences: (preferences: Partial<Pick<FinancialSnapshot['preferences'], 'currency' | 'dateFormat' | 'timezone' | 'monthlyBudget'>>) => Promise<void>;
  onRefresh: () => Promise<void>;
  onReconnect: () => void;
  onDisconnect: () => void;
  onSignOut: () => void;
  busy: boolean;
}

type Period = 'week' | 'month' | '30d' | 'all';
type MovementPeriodFilter = 'all' | 'today' | 'week' | 'month';

const accentColors = ['#72d694', '#55a8ff', '#ff656d', '#f2a04a', '#9a83ff', '#b3b7bf'];

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency || 'MXN', maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || 'MXN'}`;
  }
}

function dateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get('year')}-${map.get('month')}-${map.get('day')}`;
}

function displayDate(value: string, timezone: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', { timeZone: timezone || 'America/Mexico_City', day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX')
    .replace(/\s+/g, ' ')
    .trim();
}

function longDisplayDate(value: string, timezone: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: timezone || 'America/Mexico_City',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'U';
}

function linePoints(values: number[], width = 560, height = 150): string {
  if (values.length === 0) return `0,${height - 12} ${width},${height - 12}`;
  const max = Math.max(...values, 1);
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (width * index) / (values.length - 1);
    const y = height - 12 - (value / max) * (height - 30);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function EmptyState({ title, detail, onAdd }: { title: string; detail: string; onAdd?: () => void }) {
  return (
    <div className="crystal-empty-state">
      <span className="crystal-empty-icon"><FileSpreadsheet size={20} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
      {onAdd && <button type="button" className="crystal-button crystal-button-primary crystal-button-small" onClick={onAdd}><Plus size={14} />Registrar movimiento</button>}
    </div>
  );
}

function PanelHeading({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="crystal-panel-heading"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}

function TransactionRow({ transaction, currency, timezone, onEdit, onDelete }: { key?: React.Key; transaction: Transaction; currency: string; timezone: string; onEdit?: () => void; onDelete?: () => void }) {
  const income = transaction.type === 'income';
  return (
    <article className="crystal-transaction-row">
      <span className={`crystal-transaction-icon ${income ? 'is-income' : 'is-expense'}`}>{income ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
      <div className="crystal-transaction-copy"><strong>{transaction.description}</strong><small>{transaction.category} · {displayDate(transaction.date, timezone)}</small></div>
      <div className="crystal-transaction-amount"><strong className={income ? 'is-income' : 'is-expense'}>{income ? '+' : '-'}{formatMoney(transaction.amount, currency)}</strong><small>{transaction.paymentMethod}</small></div>
      {(onEdit || onDelete) && <div className="crystal-row-actions">{onEdit && <button type="button" aria-label="Editar movimiento" onClick={onEdit}><Pencil size={14} /></button>}{onDelete && <button type="button" aria-label="Archivar movimiento" onClick={onDelete}><Trash2 size={14} /></button>}</div>}
    </article>
  );
}

function Donut({ slices, total, currency }: { slices: Array<{ category: string; amount: number; percentage: number; color: string }>; total: number; currency: string }) {
  if (slices.length === 0) return <EmptyState title="Aún no hay gastos" detail="Registra un gasto para ver la distribución por categoría." />;
  let cursor = 0;
  const stops = slices.map((slice) => {
    const start = cursor;
    cursor += slice.percentage;
    return `${slice.color} ${start}% ${cursor}%`;
  }).join(', ');
  return (
    <div className="crystal-donut-layout">
      <div className="crystal-donut" style={{ background: `conic-gradient(${stops})` }}><div><strong>{formatMoney(total, currency)}</strong><small>Total</small></div></div>
      <div className="crystal-legend">{slices.slice(0, 6).map((slice) => <div className="crystal-legend-row" key={slice.category}><span><i style={{ background: slice.color }} />{slice.category}</span><b>{slice.percentage.toFixed(1)}%</b></div>)}</div>
    </div>
  );
}

function LineChart({ transactions, currency }: { transactions: Transaction[]; currency: string }) {
  const daily = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const transaction of transactions) {
      const row = map.get(transaction.date) ?? { income: 0, expense: 0 };
      row[transaction.type] += transaction.amount;
      map.set(transaction.date, row);
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-10);
  }, [transactions]);
  if (daily.length === 0) return <EmptyState title="Aún no hay datos para graficar" detail="El gráfico se actualiza al guardar movimientos reales." />;
  const incomeValues = daily.map(([, row]) => row.income);
  const expenseValues = daily.map(([, row]) => row.expense);
  return (
    <div className="crystal-line-chart-wrap">
      <div className="crystal-chart-legend"><span><i className="is-income" />Ingresos</span><span><i className="is-expense" />Gastos</span><small>{formatMoney(Math.max(...incomeValues, ...expenseValues, 0), currency)} máximo</small></div>
      <svg className="crystal-line-chart" viewBox="0 0 560 150" preserveAspectRatio="none" role="img" aria-label="Ingresos y gastos por día">
        {[30, 67, 104, 141].map((y) => <line key={y} x1="0" x2="560" y1={y} y2={y} className="crystal-chart-grid" />)}
        <polyline points={linePoints(incomeValues)} className="crystal-chart-income" />
        <polyline points={linePoints(expenseValues)} className="crystal-chart-expense" />
      </svg>
      <div className="crystal-chart-labels"><span>{daily[0]?.[0].slice(5)}</span><span>{daily.at(-1)?.[0].slice(5)}</span></div>
    </div>
  );
}

interface PrivacyPanelProps {
  connection: GoogleConnection;
  onRefresh: () => Promise<void>;
  onReconnect: () => void;
  onDisconnect: () => void;
  onDeleteFinancialData: () => void;
  busy: boolean;
}

function PrivacyPanel({ connection, onRefresh, onReconnect, onDisconnect, onDeleteFinancialData, busy }: PrivacyPanelProps) {
  return (
    <section className="crystal-screen crystal-privacy-screen" aria-labelledby="privacy-title">
      <div className="crystal-screen-heading">
        <div>
          <span className="crystal-kicker">Transparencia</span>
          <h1 id="privacy-title">Privacidad y control</h1>
          <p>Tu identidad se autentica en Firebase y tus finanzas viven en tu Google Sheet.</p>
        </div>
        <ShieldCheck className="crystal-privacy-heading-icon" size={28} aria-hidden="true" />
      </div>

      <div className="crystal-privacy-grid">
        <section className="crystal-panel crystal-privacy-card">
          <ShieldCheck size={18} />
          <h2>Que recaba Billqo</h2>
          <ul>
            <li>Tu identificador, correo, nombre, foto y proveedor de inicio de sesion de Firebase.</li>
            <li>El identificador, URL, estado y ultima sincronizacion de tu Sheet conectado.</li>
            <li>Los movimientos, categorias, presupuestos, recurrentes y preferencias que tu guardas.</li>
          </ul>
        </section>
        <section className="crystal-panel crystal-privacy-card">
          <CircleHelp size={18} />
          <h2>Que no recaba</h2>
          <ul>
            <li>No guardamos movimientos financieros en Firebase ni en una base de datos propia.</li>
            <li>No vemos tu contrasena de Google ni archivos de Drive que no autorices para Billqo.</li>
            <li>No usamos cifras de demostracion ni enviamos tus registros a una cuenta compartida.</li>
          </ul>
        </section>
        <section className="crystal-panel crystal-privacy-card">
          <FileSpreadsheet size={18} />
          <h2>Como se usa tu conexion</h2>
          <p>Billqo solicita acceso para crear y actualizar el archivo financiero en tu Drive. El token de renovacion se cifra en el servidor; nunca se envia al navegador.</p>
          <p>Desconectar revoca la autorizacion y borra la metadata de conexion de Billqo, pero no borra tu archivo de Drive.</p>
        </section>
        <section className="crystal-panel crystal-privacy-card crystal-privacy-danger-card">
          <Trash2 size={18} />
          <h2>Borrar tus datos</h2>
          <p>El borrado permanente elimina del Sheet los movimientos, presupuestos y recurrentes. Conservamos solo las pestanas de categorias y configuracion para mantener la estructura del archivo.</p>
          <p>Para borrar el archivo completo, abre Google Drive y mandalo a la papelera. Esa accion la controlas tu.</p>
        </section>
      </div>

      <section className="crystal-panel crystal-privacy-actions">
        <div>
          <strong>Control de tu archivo</strong>
          <small>{connection.spreadsheetId ? 'Conectado a tu documento privado.' : 'Sin documento conectado.'}</small>
        </div>
        <div className="crystal-privacy-action-buttons">
          {connection.spreadsheetUrl && <button type="button" className="crystal-button crystal-button-ghost" onClick={() => window.open(connection.spreadsheetUrl, '_blank', 'noopener,noreferrer')}><FileSpreadsheet size={15} />Abrir mi Sheet</button>}
          <button type="button" className="crystal-button crystal-button-ghost" onClick={() => void onRefresh()} disabled={busy}><RefreshCw size={15} />Sincronizar</button>
          <button type="button" className="crystal-button crystal-button-ghost" onClick={onReconnect} disabled={busy}>Volver a conectar</button>
          <button type="button" className="crystal-button crystal-button-danger" onClick={onDisconnect} disabled={busy}>Desconectar</button>
          <button type="button" className="crystal-button crystal-button-danger" onClick={onDeleteFinancialData} disabled={busy}><Trash2 size={15} />Borrar datos del Sheet</button>
        </div>
      </section>
    </section>
  );
}

export function CrystalWorkspace({ snapshot, connection, user, activeView, onViewChange, onOpenAdd, onEditTransaction, onDeleteTransaction, onDeleteAllTransactions, onDeleteFinancialData, onSaveBudget, onSavePreferences, onRefresh, onReconnect, onDisconnect, onSignOut, busy }: CrystalWorkspaceProps) {
  // Start with the complete financial picture; narrower periods are optional.
  const [period, setPeriod] = useState<Period>('all');
  const [moreOpen, setMoreOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [movementType, setMovementType] = useState<'all' | TransactionType>('all');
  const [movementCategory, setMovementCategory] = useState('all');
  const [movementPeriod, setMovementPeriod] = useState<MovementPeriodFilter>('all');
  const [necessaryOnly, setNecessaryOnly] = useState(false);
  const [highInfluenceOnly, setHighInfluenceOnly] = useState(false);
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [preferenceDraft, setPreferenceDraft] = useState(snapshot.preferences);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportMessage, setExportMessage] = useState('');

  useEffect(() => setPreferenceDraft(snapshot.preferences), [snapshot.preferences]);

  const today = dateInTimezone(new Date(), snapshot.preferences.timezone);
  const periodTransactions = useMemo(() => {
    if (period === 'all') return snapshot.transactions;
    if (period === 'week') {
      const currentDate = new Date(`${today}T12:00:00.000Z`);
      const dayOfWeek = currentDate.getUTCDay() || 7;
      currentDate.setUTCDate(currentDate.getUTCDate() - dayOfWeek + 1);
      const weekStart = currentDate.toISOString().slice(0, 10);
      return snapshot.transactions.filter((transaction) => transaction.date >= weekStart && transaction.date <= today);
    }
    if (period === '30d') {
      const cutoff = new Date(`${today}T12:00:00.000Z`);
      cutoff.setUTCDate(cutoff.getUTCDate() - 30);
      const cutoffDate = cutoff.toISOString().slice(0, 10);
      return snapshot.transactions.filter((transaction) => transaction.date >= cutoffDate && transaction.date <= today);
    }
    const monthStart = `${today.slice(0, 7)}-01`;
    return snapshot.transactions.filter((transaction) => transaction.date >= monthStart && transaction.date <= today);
  }, [period, snapshot.transactions, today]);

  const analytics = useMemo(() => calculateAnalytics(periodTransactions, snapshot.budgets, { timezone: snapshot.preferences.timezone }), [periodTransactions, snapshot.budgets, snapshot.preferences.timezone]);
  const slices = analytics.expensesByCategory.map((slice, index) => ({ ...slice, color: accentColors[index % accentColors.length]! }));
  const periodLabel = period === 'week' ? 'esta semana' : period === 'month' ? 'este mes' : period === '30d' ? 'los últimos 30 días' : 'todo el historial';

  const movementWeekStart = useMemo(() => {
    const currentDate = new Date(`${today}T12:00:00.000Z`);
    const dayOfWeek = currentDate.getUTCDay() || 7;
    currentDate.setUTCDate(currentDate.getUTCDate() - dayOfWeek + 1);
    return currentDate.toISOString().slice(0, 10);
  }, [today]);
  const movementMonthStart = `${today.slice(0, 7)}-01`;

  const filteredMovements = useMemo(() => snapshot.transactions.filter((transaction) => {
    const normalizedSearch = normalizeSearchText(search);
    const searchHaystack = normalizeSearchText([
      transaction.description,
      transaction.category,
      transaction.notes ?? '',
      transaction.paymentMethod,
      transaction.type === 'income' ? 'ingreso ingresos income' : 'gasto gastos expense',
      transaction.necessity ?? '',
      transaction.fixedVariable ?? '',
      transaction.costType,
      transaction.date,
      displayDate(transaction.date, snapshot.preferences.timezone),
      longDisplayDate(transaction.date, snapshot.preferences.timezone),
      String(transaction.amount),
      transaction.amount.toFixed(2),
      formatMoney(transaction.amount, snapshot.preferences.currency),
    ].join(' '));
    const matchesSearch = !normalizedSearch || searchHaystack.includes(normalizedSearch);
    const matchesType = movementType === 'all' || transaction.type === movementType;
    const matchesCategory = movementCategory === 'all' || transaction.categoryId === movementCategory || transaction.category === movementCategory;
    const matchesPeriod = movementPeriod === 'all'
      || (movementPeriod === 'today' && transaction.date === today)
      || (movementPeriod === 'week' && transaction.date >= movementWeekStart && transaction.date <= today)
      || (movementPeriod === 'month' && transaction.date >= movementMonthStart && transaction.date <= today);
    const matchesNecessary = !necessaryOnly || transaction.necessity === 'Necesario';
    const matchesHighInfluence = !highInfluenceOnly || (transaction.type === 'expense' && (transaction.influence ?? 0) >= 4);
    return matchesSearch && matchesType && matchesCategory && matchesPeriod && matchesNecessary && matchesHighInfluence;
  }), [
    highInfluenceOnly,
    movementCategory,
    movementMonthStart,
    movementPeriod,
    movementType,
    movementWeekStart,
    necessaryOnly,
    search,
    snapshot.preferences.currency,
    snapshot.preferences.timezone,
    snapshot.transactions,
    today,
  ]);
  const expenseCategories = snapshot.categories.filter((category) => category.type === 'expense' && category.active);
  const budgetByCategory = new Map(snapshot.budgets.map((budget) => [budget.categoryId ?? budget.category, budget]));
  const hasMovementFilters = Boolean(search.trim()) || movementType !== 'all' || movementCategory !== 'all' || movementPeriod !== 'all' || necessaryOnly || highInfluenceOnly;

  const movementChipClass = (active: boolean) => `h-9 shrink-0 rounded-full border px-3 text-[12px] font-semibold transition active:scale-[0.98] ${active
    ? 'border-white/[0.28] bg-white/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-2xl'
    : 'border-white/[0.10] bg-white/[0.035] text-white/50 backdrop-blur-xl'}`;

  const clearMovementFilters = () => {
    setSearch('');
    setMovementType('all');
    setMovementCategory('all');
    setMovementPeriod('all');
    setNecessaryOnly(false);
    setHighInfluenceOnly(false);
  };

  const changeView = (view: CrystalView) => {
    setMoreOpen(false);
    onViewChange(view);
  };

  const exportData = () => {
    const rows = snapshot.transactions;
    const content = exportFormat === 'json'
      ? JSON.stringify({ storage: 'Google Sheets', spreadsheetId: connection.spreadsheetId, exportedAt: new Date().toISOString(), transactions: rows }, null, 2)
      : [
          ['id', 'date', 'type', 'amount', 'description', 'category', 'paymentMethod', 'notes'].join(','),
          ...rows.map((transaction) => [transaction.id, transaction.date, transaction.type, transaction.amount, transaction.description, transaction.category, transaction.paymentMethod, transaction.notes ?? ''].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')),
        ].join('\n');
    const blob = new Blob([content], { type: exportFormat === 'json' ? 'application/json' : 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `billqo-movimientos-${today}.${exportFormat}`;
    link.click();
    URL.revokeObjectURL(url);
    setExportMessage(`Exportación ${exportFormat.toUpperCase()} preparada con ${rows.length} movimiento(s).`);
  };

  const navItems: Array<{ id: CrystalView; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { id: 'dashboard', label: 'Inicio', icon: Home },
    { id: 'movements', label: 'Movimientos', icon: WalletCards },
    { id: 'insights', label: 'Insights', icon: BarChart3 },
    { id: 'budgets', label: 'Presupuestos', icon: Layers3 },
    { id: 'privacy', label: 'Privacidad', icon: ShieldCheck },
  ];

  const renderDashboard = () => (
    <section className="crystal-screen" aria-labelledby="dashboard-title">
      <div className="crystal-screen-heading">
        <div><h1 id="dashboard-title">¡{greeting()}, {user.name.split(/\s+/)[0]}! <span className="crystal-greeting-wave" aria-hidden="true">👋</span></h1><p>Así van tus finanzas durante {periodLabel}.</p></div>
        <div className="crystal-heading-actions"><label className="crystal-select"><span className="sr-only">Periodo</span><select value={period} onChange={(event) => setPeriod(event.target.value as Period)}><option value="week">Esta semana</option><option value="month">Este mes</option><option value="30d">Últimos 30 días</option><option value="all">Todo el historial</option></select><ChevronDown size={14} /></label><button type="button" className="crystal-button crystal-button-primary crystal-desktop-add" onClick={onOpenAdd}><Plus size={15} />Nuevo movimiento</button></div>
      </div>
      <section className="crystal-panel crystal-balance-panel">
        <div className="crystal-balance-header"><div><span>Balance del periodo</span><strong>{formatMoney(analytics.netBalance, snapshot.preferences.currency)}</strong></div><div className="crystal-orb-small" aria-hidden="true" /><span className={`crystal-trend ${analytics.netBalance >= 0 ? 'is-income' : 'is-expense'}`}>{analytics.savingsRate === null ? 'Sin tasa de ahorro' : `${analytics.savingsRate.toFixed(1)}% de ahorro`}</span></div>
        <div className="crystal-metric-grid"><div><span><i className="metric-dot is-income" />Ingresos</span><strong>{formatMoney(analytics.totalIncome, snapshot.preferences.currency)}</strong></div><div><span><i className="metric-dot is-expense" />Gastos</span><strong>{formatMoney(analytics.totalExpenses, snapshot.preferences.currency)}</strong></div><div><span><i className="metric-dot is-balance" />Promedio diario</span><strong>{formatMoney(analytics.averageDailyExpense, snapshot.preferences.currency)}</strong></div></div>
        <div className="crystal-mini-bars" aria-label="Gastos agregados por semana">{(analytics.weeklyExpenses.length ? analytics.weeklyExpenses : []).slice(-8).map((item) => <i key={item.week} style={{ height: `${Math.max(8, Math.min(100, analytics.totalExpenses ? (item.amount / analytics.totalExpenses) * 100 : 8))}%` }} />)}</div>
      </section>
      <div className="crystal-dashboard-grid">
        <section className="crystal-panel"><PanelHeading title="Últimos movimientos" detail="Datos sincronizados desde Google Sheets" action={<button type="button" className="crystal-text-button" onClick={() => changeView('movements')}>Ver todos <ArrowUpRight size={13} /></button>} />{periodTransactions.length === 0 ? <EmptyState title="Tu historial está vacío" detail="Registra tu primer ingreso o gasto para ver el resumen." onAdd={onOpenAdd} /> : <div className="crystal-transaction-list">{periodTransactions.slice(0, 5).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} currency={snapshot.preferences.currency} timezone={snapshot.preferences.timezone} />)}</div>}</section>
        <section className="crystal-panel"><PanelHeading title="Gastos por categoría" detail={slices.length ? `Distribución de ${periodLabel}` : 'Se construye con tus movimientos'} /><Donut slices={slices} total={analytics.totalExpenses} currency={snapshot.preferences.currency} /></section>
      </div>
      <section className="crystal-panel"><PanelHeading title="Ingresos vs gastos" detail="Tendencia calculada desde tus registros" /><LineChart transactions={periodTransactions} currency={snapshot.preferences.currency} /></section>
    </section>
  );

  const renderMovements = () => (
    <section className="crystal-screen" aria-labelledby="movements-title">
      <div className="crystal-screen-heading"><div><h1 id="movements-title">Movimientos</h1><p>Busca por comercio, monto, mes, categoría o método y combina filtros rápidos.</p></div><button type="button" className="crystal-button crystal-button-primary" onClick={onOpenAdd}><Plus size={15} />Nuevo movimiento</button></div>
      <section className="crystal-panel crystal-filter-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <div className="crystal-search min-w-[min(100%,280px)] flex-1"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Uber, $500, agosto, Comida…" inputMode="search" /></div>
          <label className="crystal-select min-w-[180px] max-[560px]:min-w-0 max-[560px]:flex-1"><span className="sr-only">Categoría</span><select value={movementCategory} onChange={(event) => setMovementCategory(event.target.value)}><option value="all">Todas las categorías</option>{snapshot.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><ChevronDown size={14} /></label>
          <span className="crystal-filter-count shrink-0"><Filter size={14} />{filteredMovements.length} registro(s)</span>
        </div>
        <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filtros rápidos de movimientos">
          <button type="button" className={movementChipClass(movementPeriod === 'today')} aria-pressed={movementPeriod === 'today'} onClick={() => setMovementPeriod((current) => current === 'today' ? 'all' : 'today')}>Hoy</button>
          <button type="button" className={movementChipClass(movementPeriod === 'week')} aria-pressed={movementPeriod === 'week'} onClick={() => setMovementPeriod((current) => current === 'week' ? 'all' : 'week')}>Semana</button>
          <button type="button" className={movementChipClass(movementPeriod === 'month')} aria-pressed={movementPeriod === 'month'} onClick={() => setMovementPeriod((current) => current === 'month' ? 'all' : 'month')}>Mes</button>
          <span className="my-1 w-px shrink-0 bg-white/[0.08]" aria-hidden="true" />
          <button type="button" className={movementChipClass(movementType === 'expense')} aria-pressed={movementType === 'expense'} onClick={() => setMovementType((current) => current === 'expense' ? 'all' : 'expense')}>Gastos</button>
          <button type="button" className={movementChipClass(movementType === 'income')} aria-pressed={movementType === 'income'} onClick={() => setMovementType((current) => current === 'income' ? 'all' : 'income')}>Ingresos</button>
          <button type="button" className={movementChipClass(necessaryOnly)} aria-pressed={necessaryOnly} onClick={() => setNecessaryOnly((current) => !current)}>Necesarios</button>
          <button type="button" className={movementChipClass(highInfluenceOnly)} aria-pressed={highInfluenceOnly} onClick={() => setHighInfluenceOnly((current) => !current)}>Impulso alto</button>
          {hasMovementFilters && <button type="button" className="h-9 shrink-0 rounded-full px-2.5 text-[11px] font-semibold text-white/35 transition hover:text-white/65" onClick={clearMovementFilters}><X size={13} className="inline-block" /> Limpiar</button>}
        </div>
      </section>
      <section className="crystal-panel crystal-list-panel">{filteredMovements.length === 0 ? <EmptyState title="No hay coincidencias" detail="Prueba otra búsqueda o limpia los filtros." onAdd={onOpenAdd} /> : <div className="crystal-transaction-list">{filteredMovements.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} currency={snapshot.preferences.currency} timezone={snapshot.preferences.timezone} onEdit={() => onEditTransaction(transaction)} onDelete={() => onDeleteTransaction(transaction)} />)}</div>}</section>
      {snapshot.transactions.length > 0 && <button type="button" className="crystal-danger-link" onClick={onDeleteAllTransactions}><Trash2 size={14} />Archivar todos los movimientos</button>}
    </section>
  );

  const renderInsights = () => {
    const insightData = buildDeterministicInsights(analytics, periodTransactions);
    return <section className="crystal-screen" aria-labelledby="insights-title"><div className="crystal-screen-heading"><div><span className="crystal-kicker">Lectura del comportamiento</span><h1 id="insights-title">Insights</h1><p>Señales derivadas de tus datos, sin inventar cifras.</p></div><button type="button" className="crystal-button crystal-button-ghost" onClick={() => void onRefresh()} disabled={busy}><RefreshCw size={15} className={busy ? 'crystal-spin' : ''} />Sincronizar</button></div><section className="crystal-insight-summary crystal-panel"><Sparkles size={18} /><p>{insightData.summary}</p></section><div className="crystal-dashboard-grid"><section className="crystal-panel"><PanelHeading title="Evolución del balance" detail={periodLabel} /><LineChart transactions={periodTransactions} currency={snapshot.preferences.currency} /></section><section className="crystal-panel"><PanelHeading title="Distribución de gastos" detail="Por categoría" /><Donut slices={slices} total={analytics.totalExpenses} currency={snapshot.preferences.currency} /></section></div><section className="crystal-panel"><PanelHeading title="Observaciones" detail="Calculadas automáticamente" /><div className="crystal-insight-list">{insightData.insights.map((item) => <article key={`${item.title}-${item.description}`}><span className={`crystal-insight-icon ${item.type}`}><CircleHelp size={17} /></span><div><strong>{item.title}</strong><p>{item.description}</p></div></article>)}</div>{insightData.recommendations.length > 0 && <div className="crystal-recommendations"><strong>Próximos pasos</strong>{insightData.recommendations.map((recommendation) => <p key={recommendation}><Check size={14} />{recommendation}</p>)}</div>}</section></section>;
  };

  const renderBudgets = () => <section className="crystal-screen" aria-labelledby="budgets-title"><div className="crystal-screen-heading"><div><span className="crystal-kicker">Límites reales</span><h1 id="budgets-title">Presupuestos</h1><p>Define límites por categoría y compáralos con tus gastos.</p></div><div className="crystal-global-budget"><span>Presupuesto global</span><strong>{snapshot.preferences.monthlyBudget > 0 ? formatMoney(snapshot.preferences.monthlyBudget, snapshot.preferences.currency) : 'Sin límite'}</strong></div></div><section className="crystal-budget-grid">{expenseCategories.length === 0 ? <div className="crystal-panel"><EmptyState title="No hay categorías de gasto" detail="Tu Google Sheet todavía no tiene un catálogo para presupuestar." /></div> : expenseCategories.map((category) => { const budget = budgetByCategory.get(category.id) ?? snapshot.budgets.find((item) => item.category === category.name); const limit = budget?.allocatedAmount ?? 0; const spent = budget?.spentAmount ?? 0; const percentage = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0; return <article className="crystal-panel crystal-budget-card" key={category.id}><div className="crystal-budget-card-head"><div><strong>{category.name}</strong><small>{limit > 0 ? `${formatMoney(spent, snapshot.preferences.currency)} de ${formatMoney(limit, snapshot.preferences.currency)}` : 'Sin límite configurado'}</small></div><span className="crystal-budget-ring" style={{ '--progress': `${percentage}%` } as React.CSSProperties}>{limit > 0 ? `${percentage.toFixed(0)}%` : '—'}</span></div><div className="crystal-progress"><i style={{ width: `${percentage}%` }} /></div><div className="crystal-budget-editor"><input type="number" min="0" step="0.01" value={budgetDrafts[category.id] ?? (limit > 0 ? String(limit) : '')} onChange={(event) => setBudgetDrafts((current) => ({ ...current, [category.id]: event.target.value }))} placeholder="Límite" /><button type="button" className="crystal-button crystal-button-small crystal-button-primary" onClick={() => { const amount = Number(budgetDrafts[category.id] ?? limit); if (Number.isFinite(amount) && amount >= 0) void onSaveBudget(category.id, amount); }}>Guardar</button></div></article>; })}</section></section>;

  const renderCategories = () => {
    const categoryStats = new Map<string, { count: number; amount: number }>();
    for (const transaction of snapshot.transactions) { const key = transaction.categoryId ?? transaction.category; const current = categoryStats.get(key) ?? { count: 0, amount: 0 }; current.count += 1; if (transaction.type === 'expense') current.amount += transaction.amount; categoryStats.set(key, current); }
    return <section className="crystal-screen" aria-labelledby="categories-title"><div className="crystal-screen-heading"><div><span className="crystal-kicker">Catálogo Google Sheet</span><h1 id="categories-title">Categorías</h1><p>Clasificación disponible para tus ingresos y gastos.</p></div></div><section className="crystal-category-grid">{snapshot.categories.map((category, index) => { const stat = categoryStats.get(category.id) ?? categoryStats.get(category.name) ?? { count: 0, amount: 0 }; return <article className="crystal-panel crystal-category-card" key={category.id}><span className="crystal-category-icon" style={{ color: accentColors[index % accentColors.length] }}><Layers3 size={17} /></span><div><div className="crystal-category-title"><strong>{category.name}</strong><small>{category.type === 'income' ? 'Ingreso' : 'Gasto'}</small></div><b>{stat.count} movimiento(s)</b><span>{category.type === 'expense' ? formatMoney(stat.amount, snapshot.preferences.currency) : 'Se registra por separado'}</span></div></article>; })}</section></section>;
  };

  const renderSettings = () => <section className="crystal-screen" aria-labelledby="settings-title"><div className="crystal-screen-heading"><div><span className="crystal-kicker">Cuenta y preferencias</span><h1 id="settings-title">Configuración</h1><p>Controla cómo se muestran y guardan tus datos.</p></div></div><div className="crystal-settings-grid"><form className="crystal-panel crystal-settings-card" onSubmit={(event) => { event.preventDefault(); void onSavePreferences({ currency: preferenceDraft.currency, dateFormat: preferenceDraft.dateFormat, timezone: preferenceDraft.timezone, monthlyBudget: Number(preferenceDraft.monthlyBudget) }); }}><PanelHeading title="Preferencias" detail="Se guardan en tu Google Sheet privado." /><label>Moneda<input value={preferenceDraft.currency} onChange={(event) => setPreferenceDraft((current) => ({ ...current, currency: event.target.value }))} /></label><label>Formato de fecha<input value={preferenceDraft.dateFormat} onChange={(event) => setPreferenceDraft((current) => ({ ...current, dateFormat: event.target.value }))} /></label><label>Zona horaria<input value={preferenceDraft.timezone} onChange={(event) => setPreferenceDraft((current) => ({ ...current, timezone: event.target.value }))} /></label><label>Presupuesto global<input type="number" min="0" step="0.01" value={preferenceDraft.monthlyBudget} onChange={(event) => setPreferenceDraft((current) => ({ ...current, monthlyBudget: Number(event.target.value) }))} /></label><button type="submit" className="crystal-button crystal-button-primary" disabled={busy}>Guardar preferencias</button></form><section className="crystal-panel crystal-settings-card"><PanelHeading title="Google Sheets" detail="Origen de datos de esta cuenta." /><div className="crystal-connection-status"><span>{connection.spreadsheetId ? <Check size={16} /> : <FileSpreadsheet size={16} />}{connection.spreadsheetId ? 'Conectado' : 'Sin conectar'}</span><small>{connection.spreadsheetId ? 'Billqo - Mis Finanzas' : 'El archivo se crea al conectar Google'}</small></div><p>Tu información vive en tu Google Sheet privado. La aplicación no usa cifras de demostración.</p><button type="button" className="crystal-button crystal-button-ghost" onClick={() => void onRefresh()} disabled={busy}><RefreshCw size={15} />Actualizar datos</button><button type="button" className="crystal-button crystal-button-ghost" onClick={() => changeView('export')}><Download size={15} />Exportar datos</button><button type="button" className="crystal-button crystal-button-danger" onClick={onSignOut}><LogOut size={15} />Cerrar sesión</button></section></div></section>;

  const renderExport = () => <section className="crystal-screen" aria-labelledby="export-title"><div className="crystal-screen-heading"><div><span className="crystal-kicker">Tus datos</span><h1 id="export-title">Exportar datos</h1><p>Descarga una copia de los movimientos que existen en tu Google Sheet.</p></div></div><section className="crystal-panel crystal-export-card"><div className="crystal-export-icon"><Download size={24} /></div><h2>Elige un formato</h2><p>La exportación usa únicamente tus movimientos actuales, sin datos agregados de ejemplo.</p><div className="crystal-export-options"><button type="button" className={exportFormat === 'csv' ? 'is-active' : ''} onClick={() => setExportFormat('csv')}><FileSpreadsheet size={19} /><span>CSV<small>Compatible con hojas de cálculo</small></span></button><button type="button" className={exportFormat === 'json' ? 'is-active' : ''} onClick={() => setExportFormat('json')}><FileJson size={19} /><span>JSON<small>Formato estructurado</small></span></button></div><button type="button" className="crystal-button crystal-button-primary crystal-export-action" onClick={exportData} disabled={snapshot.transactions.length === 0}><Download size={15} />Exportar {snapshot.transactions.length} movimiento(s)</button>{exportMessage && <p className="crystal-success-message"><Check size={15} />{exportMessage}</p>}</section></section>;

  const renderSettingsGoogle = () => <section className="crystal-screen" aria-labelledby="settings-google-title"><div className="crystal-screen-heading"><div><span className="crystal-kicker">Cuenta y preferencias</span><h1 id="settings-google-title">Configuracion</h1><p>Controla como se muestran y guardan tus datos.</p></div></div><div className="crystal-settings-grid"><form className="crystal-panel crystal-settings-card" onSubmit={(event) => { event.preventDefault(); void onSavePreferences({ currency: preferenceDraft.currency, dateFormat: preferenceDraft.dateFormat, timezone: preferenceDraft.timezone, monthlyBudget: Number(preferenceDraft.monthlyBudget) }); }}><PanelHeading title="Preferencias" detail="Se guardan en tu Google Sheet privado." /><label>Moneda<input value={preferenceDraft.currency} onChange={(event) => setPreferenceDraft((current) => ({ ...current, currency: event.target.value }))} /></label><label>Formato de fecha<input value={preferenceDraft.dateFormat} onChange={(event) => setPreferenceDraft((current) => ({ ...current, dateFormat: event.target.value }))} /></label><label>Zona horaria<input value={preferenceDraft.timezone} onChange={(event) => setPreferenceDraft((current) => ({ ...current, timezone: event.target.value }))} /></label><label>Presupuesto global<input type="number" min="0" step="0.01" value={preferenceDraft.monthlyBudget} onChange={(event) => setPreferenceDraft((current) => ({ ...current, monthlyBudget: Number(event.target.value) }))} /></label><button type="submit" className="crystal-button crystal-button-primary" disabled={busy}>Guardar preferencias</button></form><section className="crystal-panel crystal-settings-card"><PanelHeading title="Google Sheets" detail="Tu documento financiero privado." /><div className="crystal-connection-status"><span>{connection.spreadsheetId ? <Check size={16} /> : <FileSpreadsheet size={16} />}{connection.spreadsheetId ? 'Conectado' : 'Sin conectar'}</span><small>{connection.spreadsheetId ? 'Billqo - Mis Finanzas' : 'El archivo se crea al conectar Google'}</small></div><p>Todos tus movimientos, categorias, presupuestos y preferencias se leen y actualizan directamente en tu Google Sheet.</p><div className="crystal-settings-actions"><button type="button" className="crystal-button crystal-button-ghost" onClick={() => void onRefresh()} disabled={busy}><RefreshCw size={15} />Sincronizar ahora</button>{connection.spreadsheetUrl && <button type="button" className="crystal-button crystal-button-ghost" onClick={() => window.open(connection.spreadsheetUrl, '_blank', 'noopener,noreferrer')}><FileSpreadsheet size={15} />Abrir mi Sheet</button>}<button type="button" className="crystal-button crystal-button-ghost" onClick={onReconnect} disabled={busy}>Volver a conectar Google</button><button type="button" className="crystal-button crystal-button-danger" onClick={onDisconnect} disabled={busy}>Desconectar Sheet</button><button type="button" className="crystal-button crystal-button-ghost" onClick={() => changeView('export')}><Download size={15} />Exportar datos</button><button type="button" className="crystal-button crystal-button-danger" onClick={onSignOut}><LogOut size={15} />Cerrar sesion</button></div></section></div></section>;

  const renderDashboardGoogle = () => <section className="crystal-screen" aria-labelledby="dashboard-google-title"><div className="crystal-screen-heading"><div><h1 id="dashboard-google-title">Hola, {user.name.split(/\s+/)[0]} <span className="crystal-greeting-wave" aria-hidden="true">👋</span></h1><p>Asi van tus finanzas durante {periodLabel}.</p></div><div className="crystal-heading-actions"><label className="crystal-select"><span className="sr-only">Periodo</span><select value={period} onChange={(event) => setPeriod(event.target.value as Period)}><option value="week">Esta semana</option><option value="month">Este mes</option><option value="30d">Ultimos 30 dias</option><option value="all">Todo el historial</option></select><ChevronDown size={14} /></label><button type="button" className="crystal-button crystal-button-primary crystal-desktop-add" onClick={onOpenAdd}><Plus size={15} />Nuevo movimiento</button></div></div><section className="crystal-panel crystal-balance-panel"><div className="crystal-balance-header"><div><span>Balance del periodo</span><strong>{formatMoney(analytics.netBalance, snapshot.preferences.currency)}</strong></div><div className="crystal-orb-small" aria-hidden="true" /><span className={`crystal-trend ${analytics.netBalance >= 0 ? 'is-income' : 'is-expense'}`}>{analytics.savingsRate === null ? 'Sin tasa de ahorro' : `${analytics.savingsRate.toFixed(1)}% de ahorro`}</span></div><div className="crystal-metric-grid"><div><span><i className="metric-dot is-income" />Ingresos</span><strong>{formatMoney(analytics.totalIncome, snapshot.preferences.currency)}</strong></div><div><span><i className="metric-dot is-expense" />Gastos</span><strong>{formatMoney(analytics.totalExpenses, snapshot.preferences.currency)}</strong></div><div><span><i className="metric-dot is-balance" />Promedio diario</span><strong>{formatMoney(analytics.averageDailyExpense, snapshot.preferences.currency)}</strong></div></div><div className="crystal-mini-bars" aria-label="Gastos agregados por semana">{analytics.weeklyExpenses.slice(-8).map((item) => <i key={item.week} style={{ height: `${Math.max(8, Math.min(100, analytics.totalExpenses ? (item.amount / analytics.totalExpenses) * 100 : 8))}%` }} />)}</div></section><div className="crystal-dashboard-grid"><section className="crystal-panel"><PanelHeading title="Ultimos movimientos" detail="Datos sincronizados desde tu Google Sheet" action={<button type="button" className="crystal-text-button" onClick={() => changeView('movements')}>Ver todos <ArrowUpRight size={13} /></button>} />{periodTransactions.length === 0 ? <EmptyState title="Tu historial esta vacio" detail="Registra tu primer ingreso o gasto para ver el resumen." onAdd={onOpenAdd} /> : <div className="crystal-transaction-list">{periodTransactions.slice(0, 5).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} currency={snapshot.preferences.currency} timezone={snapshot.preferences.timezone} />)}</div>}</section><section className="crystal-panel"><PanelHeading title="Gastos por categoria" detail={slices.length ? `Distribucion de ${periodLabel}` : 'Se construye con tus movimientos'} /><Donut slices={slices} total={analytics.totalExpenses} currency={snapshot.preferences.currency} /></section></div><section className="crystal-panel"><PanelHeading title="Ingresos vs gastos" detail="Tendencia calculada desde tus registros" /><LineChart transactions={periodTransactions} currency={snapshot.preferences.currency} /></section></section>;

  const renderBudgetsGoogle = () => <section className="crystal-screen" aria-labelledby="budgets-google-title"><div className="crystal-screen-heading"><div><span className="crystal-kicker">Limites reales</span><h1 id="budgets-google-title">Presupuestos</h1><p>Define limites por categoria y comparalos con tus gastos.</p></div><div className="crystal-global-budget"><span>Presupuesto global</span><strong>{snapshot.preferences.monthlyBudget > 0 ? formatMoney(snapshot.preferences.monthlyBudget, snapshot.preferences.currency) : 'Sin limite'}</strong></div></div><section className="crystal-budget-grid">{expenseCategories.length === 0 ? <div className="crystal-panel"><EmptyState title="No hay categorias de gasto" detail="Tu Google Sheet todavia no tiene un catalogo para presupuestar." /></div> : expenseCategories.map((category) => { const budget = budgetByCategory.get(category.id) ?? snapshot.budgets.find((item) => item.category === category.name); const limit = budget?.allocatedAmount ?? 0; const spent = budget?.spentAmount ?? 0; const percentage = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0; return <article className="crystal-panel crystal-budget-card" key={category.id}><div className="crystal-budget-card-head"><div><strong>{category.name}</strong><small>{limit > 0 ? `${formatMoney(spent, snapshot.preferences.currency)} de ${formatMoney(limit, snapshot.preferences.currency)}` : 'Sin limite configurado'}</small></div><span className="crystal-budget-ring" style={{ '--progress': `${percentage}%` } as React.CSSProperties}>{limit > 0 ? `${percentage.toFixed(0)}%` : '—'}</span></div><div className="crystal-progress"><i style={{ width: `${percentage}%` }} /></div><div className="crystal-budget-editor"><input type="number" min="0" step="0.01" value={budgetDrafts[category.id] ?? (limit > 0 ? String(limit) : '')} onChange={(event) => setBudgetDrafts((current) => ({ ...current, [category.id]: event.target.value }))} placeholder="Limite" /><button type="button" className="crystal-button crystal-button-small crystal-button-primary" onClick={() => { const amount = Number(budgetDrafts[category.id] ?? limit); if (Number.isFinite(amount) && amount >= 0) void onSaveBudget(category.id, amount); }}>Guardar</button></div></article>; })}</section></section>;

  const renderCategoriesGoogle = () => { const categoryStats = new Map<string, { count: number; amount: number }>(); for (const transaction of snapshot.transactions) { const key = transaction.categoryId ?? transaction.category; const current = categoryStats.get(key) ?? { count: 0, amount: 0 }; current.count += 1; if (transaction.type === 'expense') current.amount += transaction.amount; categoryStats.set(key, current); } return <section className="crystal-screen" aria-labelledby="categories-google-title"><div className="crystal-screen-heading"><div><span className="crystal-kicker">Catalogo Google Sheet</span><h1 id="categories-google-title">Categorias</h1><p>Clasificacion disponible para tus ingresos y gastos.</p></div></div><section className="crystal-category-grid">{snapshot.categories.map((category, index) => { const stat = categoryStats.get(category.id) ?? categoryStats.get(category.name) ?? { count: 0, amount: 0 }; return <article className="crystal-panel crystal-category-card" key={category.id}><span className="crystal-category-icon" style={{ color: accentColors[index % accentColors.length] }}><Layers3 size={17} /></span><div><div className="crystal-category-title"><strong>{category.name}</strong><small>{category.type === 'income' ? 'Ingreso' : 'Gasto'}</small></div><b>{stat.count} movimiento(s)</b><span>{category.type === 'expense' ? formatMoney(stat.amount, snapshot.preferences.currency) : 'Se registra por separado'}</span></div></article>; })}</section></section>; };

  const renderExportGoogle = () => <section className="crystal-screen" aria-labelledby="export-google-title"><div className="crystal-screen-heading"><div><span className="crystal-kicker">Tus datos</span><h1 id="export-google-title">Exportar datos</h1><p>Descarga una copia de los movimientos que existen en tu Google Sheet.</p></div></div><section className="crystal-panel crystal-export-card"><div className="crystal-export-icon"><Download size={24} /></div><h2>Elige un formato</h2><p>La exportacion usa unicamente tus movimientos actuales, sin datos agregados de ejemplo.</p><div className="crystal-export-options"><button type="button" className={exportFormat === 'csv' ? 'is-active' : ''} onClick={() => setExportFormat('csv')}><FileSpreadsheet size={19} /><span>CSV<small>Compatible con hojas de calculo</small></span></button><button type="button" className={exportFormat === 'json' ? 'is-active' : ''} onClick={() => setExportFormat('json')}><FileJson size={19} /><span>JSON<small>Formato estructurado</small></span></button></div><button type="button" className="crystal-button crystal-button-primary crystal-export-action" onClick={exportData} disabled={snapshot.transactions.length === 0}><Download size={15} />Exportar {snapshot.transactions.length} movimiento(s)</button>{exportMessage && <p className="crystal-success-message"><Check size={15} />{exportMessage}</p>}</section></section>;

  const activeContent = activeView === 'dashboard' ? renderDashboardGoogle() : activeView === 'movements' ? renderMovements() : activeView === 'insights' ? renderInsights() : activeView === 'budgets' ? renderBudgetsGoogle() : activeView === 'categories' ? renderCategoriesGoogle() : activeView === 'settings' ? renderSettingsGoogle() : renderExportGoogle();

  return (
    <div className="crystal-workspace">
      <div className="crystal-workspace-orb crystal-workspace-orb-one" aria-hidden="true" /><div className="crystal-workspace-orb crystal-workspace-orb-two" aria-hidden="true" />
      <header className="crystal-workspace-header"><div className="crystal-workspace-header-inner"><button type="button" className="crystal-workspace-brand" onClick={() => changeView('dashboard')}><span className="crystal-workspace-mark"><CuantlyMark size={20} /></span><span><strong>Billqo</strong><small>Black Crystal</small></span></button><nav className="crystal-workspace-desktop-nav" aria-label="Navegación principal">{navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={activeView === id ? 'is-active' : ''} onClick={() => changeView(id)}><Icon size={15} />{label}</button>)}</nav><div className="crystal-workspace-actions"><button type="button" className="crystal-icon-button crystal-mobile-header-menu" onClick={() => setMoreOpen((open) => !open)} aria-label="Abrir menú"><Menu size={18} /></button><button type="button" className="crystal-icon-button" onClick={() => changeView('settings')} aria-label="Configuración"><Settings size={17} /></button><button type="button" className="crystal-workspace-user" onClick={() => changeView('settings')} title={user.email}>{user.avatar ? <img src={user.avatar} alt="" /> : <span>{initials(user.name)}</span>}<b>{user.name.split(/\s+/)[0]}</b></button><button type="button" className="crystal-icon-button crystal-desktop-only" onClick={onSignOut} aria-label="Cerrar sesión"><LogOut size={17} /></button></div></div></header>
      <main className="crystal-workspace-main">{activeView === 'privacy' ? <PrivacyPanel connection={connection} onRefresh={onRefresh} onReconnect={onReconnect} onDisconnect={onDisconnect} onDeleteFinancialData={onDeleteFinancialData} busy={busy} /> : activeContent}</main>
      <nav className="crystal-mobile-nav" aria-label="Navegación móvil"><button type="button" className={activeView === 'dashboard' ? 'is-active' : ''} onClick={() => changeView('dashboard')}><Home size={18} /><span>Inicio</span></button><button type="button" className={activeView === 'movements' ? 'is-active' : ''} onClick={() => changeView('movements')}><WalletCards size={18} /><span>Movimientos</span></button><button type="button" className="crystal-mobile-add" onClick={onOpenAdd} aria-label="Nuevo movimiento"><Plus size={24} /></button><button type="button" className={activeView === 'insights' ? 'is-active' : ''} onClick={() => changeView('insights')}><BarChart3 size={18} /><span>Insights</span></button><button type="button" className={moreOpen ? 'is-active' : ''} onClick={() => setMoreOpen((open) => !open)}><MoreHorizontal size={18} /><span>Más</span></button></nav>
      {moreOpen && <div className="crystal-more-menu"><button type="button" onClick={() => changeView('budgets')}><Layers3 size={16} />Presupuestos</button><button type="button" onClick={() => changeView('categories')}><Layers3 size={16} />Categorías</button><button type="button" onClick={() => changeView('settings')}><Settings size={16} />Configuración</button><button type="button" onClick={() => changeView('privacy')}><ShieldCheck size={16} />Privacidad</button><button type="button" onClick={() => changeView('export')}><Download size={16} />Exportar datos</button><button type="button" onClick={() => setMoreOpen(false)}><X size={16} />Cerrar</button></div>}
    </div>
  );
}