import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CircleHelp,
  PiggyBank,
  RotateCcw,
  Sparkles,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { CuantlyMark } from './CuantlyBrand';

type ContributionTiming = 'beginning' | 'end';

type CompoundingFrequency = 1 | 2 | 4 | 12 | 365;

interface SavingsCalculatorWorkspaceProps {
  onBack: () => void;
  currency?: string;
}

interface ProjectionPoint {
  month: number;
  balance: number;
  contributed: number;
}

interface AnnualProjection {
  year: number;
  contributed: number;
  interest: number;
  yearInterest: number;
  balance: number;
}

const compoundingOptions: Array<{ value: CompoundingFrequency; label: string }> = [
  { value: 1, label: 'Anual' },
  { value: 2, label: 'Semestral' },
  { value: 4, label: 'Trimestral' },
  { value: 12, label: 'Mensual' },
  { value: 365, label: 'Diaria' },
];

function money(amount: number, currency = 'MXN'): string {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || 'MXN'}`;
  }
}

function percent(value: number): string {
  return `${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function chartPoints(values: number[], width = 760, height = 260, top = 18, bottom = 28): string {
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  const usableHeight = height - top - bottom;
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (width * index) / (values.length - 1);
    const y = top + usableHeight - (value / max) * usableHeight;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function SavingsCalculatorWorkspace({ onBack, currency = 'MXN' }: SavingsCalculatorWorkspaceProps) {
  const [initialBalance, setInitialBalance] = useState(10000);
  const [monthlyContribution, setMonthlyContribution] = useState(2500);
  const [annualRate, setAnnualRate] = useState(8);
  const [years, setYears] = useState(10);
  const [compoundingFrequency, setCompoundingFrequency] = useState<CompoundingFrequency>(12);
  const [contributionTiming, setContributionTiming] = useState<ContributionTiming>('end');
  const [inflationRate, setInflationRate] = useState(0);

  const projection = useMemo(() => {
    const safeInitial = Math.max(0, initialBalance);
    const safeContribution = Math.max(0, monthlyContribution);
    const safeRate = Math.max(0, annualRate) / 100;
    const safeYears = clamp(Math.round(years), 1, 50);
    const totalMonths = safeYears * 12;
    const effectiveAnnualYield = safeRate === 0
      ? 0
      : Math.pow(1 + safeRate / compoundingFrequency, compoundingFrequency) - 1;
    const monthlyRate = effectiveAnnualYield === 0
      ? 0
      : Math.pow(1 + effectiveAnnualYield, 1 / 12) - 1;

    let balance = safeInitial;
    let contributed = safeInitial;
    let yearInterest = 0;
    const points: ProjectionPoint[] = [{ month: 0, balance, contributed }];
    const annual: AnnualProjection[] = [];

    for (let month = 1; month <= totalMonths; month += 1) {
      if (contributionTiming === 'beginning') {
        balance += safeContribution;
        contributed += safeContribution;
      }

      const interestForMonth = balance * monthlyRate;
      balance += interestForMonth;
      yearInterest += interestForMonth;

      if (contributionTiming === 'end') {
        balance += safeContribution;
        contributed += safeContribution;
      }

      points.push({ month, balance, contributed });

      if (month % 12 === 0) {
        annual.push({
          year: month / 12,
          contributed,
          interest: Math.max(0, balance - contributed),
          yearInterest,
          balance,
        });
        yearInterest = 0;
      }
    }

    const interest = Math.max(0, balance - contributed);
    const gainOnContributed = contributed > 0 ? (interest / contributed) * 100 : 0;
    const realValue = inflationRate > 0
      ? balance / Math.pow(1 + Math.max(0, inflationRate) / 100, safeYears)
      : balance;

    return {
      totalMonths,
      balance,
      contributed,
      interest,
      gainOnContributed,
      effectiveAnnualYield: effectiveAnnualYield * 100,
      effectiveMonthlyRate: monthlyRate * 100,
      realValue,
      points,
      annual,
    };
  }, [annualRate, compoundingFrequency, contributionTiming, inflationRate, initialBalance, monthlyContribution, years]);

  const chartBalance = projection.points.map((point) => point.balance);
  const chartContributed = projection.points.map((point) => point.contributed);
  const chartMax = Math.max(...chartBalance, ...chartContributed, 1);
  const midpointYear = Math.max(1, Math.round(years / 2));

  const reset = () => {
    setInitialBalance(10000);
    setMonthlyContribution(2500);
    setAnnualRate(8);
    setYears(10);
    setCompoundingFrequency(12);
    setContributionTiming('end');
    setInflationRate(0);
  };

  return (
    <div className="crystal-workspace">
      <div className="crystal-workspace-orb crystal-workspace-orb-one" aria-hidden="true" />
      <div className="crystal-workspace-orb crystal-workspace-orb-two" aria-hidden="true" />

      <header className="crystal-workspace-header">
        <div className="crystal-workspace-header-inner">
          <button type="button" className="crystal-workspace-brand" onClick={onBack}>
            <span className="crystal-workspace-mark"><CuantlyMark size={20} /></span>
            <span><strong>Billqo</strong><small>Calculadora financiera</small></span>
          </button>
          <div className="crystal-workspace-actions">
            <button type="button" className="crystal-button crystal-button-ghost" onClick={onBack}>
              <ArrowLeft size={16} />Volver
            </button>
          </div>
        </div>
      </header>

      <main className="crystal-workspace-main">
        <section className="crystal-screen" aria-labelledby="savings-calculator-title">
          <div className="crystal-screen-heading">
            <div>
              <span className="crystal-kicker">Proyección de ahorro</span>
              <h1 id="savings-calculator-title">Calculadora financiera</h1>
              <p>Mueve los valores y compara cuánto aportas contra cuánto puede crecer con interés compuesto.</p>
            </div>
            <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/55 sm:flex">
              <PiggyBank size={16} />Todo se calcula localmente
            </span>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.42fr)]">
            <section className="crystal-panel flex flex-col gap-5" aria-label="Parámetros de la proyección">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-medium text-white">Tu escenario</h2>
                  <p className="mt-1 text-sm text-white/45">Saldo, aportaciones, tasa, plazo y capitalización.</p>
                </div>
                <button type="button" className="crystal-icon-button" onClick={reset} aria-label="Restablecer calculadora" title="Restablecer">
                  <RotateCcw size={15} />
                </button>
              </div>

              <label className="grid gap-2">
                <span className="flex items-center justify-between gap-3 text-sm text-white/70">
                  <span>Saldo inicial</span><strong className="font-medium text-white">{money(initialBalance, currency)}</strong>
                </span>
                <input type="range" min="0" max="1000000" step="1000" value={initialBalance} onChange={(event) => setInitialBalance(Number(event.target.value))} className="w-full accent-white" />
                <input type="number" min="0" step="100" inputMode="decimal" value={initialBalance} onChange={(event) => setInitialBalance(Math.max(0, Number(event.target.value)))} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-base text-white outline-none focus:border-white/30" />
              </label>

              <label className="grid gap-2">
                <span className="flex items-center justify-between gap-3 text-sm text-white/70">
                  <span>Aportación mensual</span><strong className="font-medium text-white">{money(monthlyContribution, currency)}</strong>
                </span>
                <input type="range" min="0" max="100000" step="500" value={Math.min(monthlyContribution, 100000)} onChange={(event) => setMonthlyContribution(Number(event.target.value))} className="w-full accent-white" />
                <input type="number" min="0" step="100" inputMode="decimal" value={monthlyContribution} onChange={(event) => setMonthlyContribution(Math.max(0, Number(event.target.value)))} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-base text-white outline-none focus:border-white/30" />
              </label>

              <label className="grid gap-2">
                <span className="flex items-center justify-between gap-3 text-sm text-white/70">
                  <span className="flex items-center gap-1.5">Tasa anual nominal <CircleHelp size={13} className="text-white/35" /></span>
                  <strong className="font-medium text-white">{percent(annualRate)}</strong>
                </span>
                <input type="range" min="0" max="30" step="0.1" value={Math.min(annualRate, 30)} onChange={(event) => setAnnualRate(Number(event.target.value))} className="w-full accent-white" />
                <div className="relative">
                  <input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={annualRate} onChange={(event) => setAnnualRate(clamp(Number(event.target.value), 0, 100))} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 pr-9 text-base text-white outline-none focus:border-white/30" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/35">%</span>
                </div>
              </label>

              <label className="grid gap-2">
                <span className="flex items-center justify-between gap-3 text-sm text-white/70">
                  <span>Plazo</span><strong className="font-medium text-white">{years} {years === 1 ? 'año' : 'años'}</strong>
                </span>
                <input type="range" min="1" max="50" step="1" value={years} onChange={(event) => setYears(Number(event.target.value))} className="w-full accent-white" />
                <div className="flex flex-wrap gap-1.5">
                  {[1, 5, 10, 20, 30].map((value) => (
                    <button key={value} type="button" onClick={() => setYears(value)} className={`rounded-full border px-2.5 py-1 text-xs transition ${years === value ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/[0.03] text-white/45 hover:text-white/70'}`}>
                      {value}a
                    </button>
                  ))}
                </div>
              </label>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <label className="grid gap-1.5 text-sm text-white/70">
                  Capitalización
                  <select value={compoundingFrequency} onChange={(event) => setCompoundingFrequency(Number(event.target.value) as CompoundingFrequency)} className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-base text-white outline-none focus:border-white/30">
                    {compoundingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm text-white/70">
                  Momento de aportación
                  <select value={contributionTiming} onChange={(event) => setContributionTiming(event.target.value as ContributionTiming)} className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-base text-white outline-none focus:border-white/30">
                    <option value="end">Fin de cada mes</option>
                    <option value="beginning">Inicio de cada mes</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-2 border-t border-white/8 pt-4">
                <span className="flex items-center justify-between gap-3 text-sm text-white/70">
                  <span>Inflación anual <span className="text-white/30">(opcional)</span></span>
                  <strong className="font-medium text-white">{percent(inflationRate)}</strong>
                </span>
                <input type="range" min="0" max="15" step="0.1" value={inflationRate} onChange={(event) => setInflationRate(Number(event.target.value))} className="w-full accent-white" />
                <p className="text-xs leading-relaxed text-white/35">Si la mueves, Billqo también estima el poder de compra del saldo final en dinero de hoy.</p>
              </label>
            </section>

            <div className="min-w-0 space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <span className="text-sm text-white/45">Saldo final</span>
                  <strong className="mt-2 block text-xl font-medium text-white">{money(projection.balance, currency)}</strong>
                  <small className="mt-1 block text-xs text-white/30">Al terminar {years} {years === 1 ? 'año' : 'años'}</small>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <span className="text-sm text-white/45">Total aportado</span>
                  <strong className="mt-2 block text-xl font-medium text-white">{money(projection.contributed, currency)}</strong>
                  <small className="mt-1 block text-xs text-white/30">Capital puesto por ti</small>
                </article>
                <article className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4">
                  <span className="text-sm text-emerald-100/55">Intereses ganados</span>
                  <strong className="mt-2 block text-xl font-medium text-emerald-200">+{money(projection.interest, currency)}</strong>
                  <small className="mt-1 block text-xs text-emerald-100/35">{percent(projection.gainOnContributed)} sobre lo aportado</small>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <span className="text-sm text-white/45">Rendimiento efectivo</span>
                  <strong className="mt-2 block text-xl font-medium text-white">{percent(projection.effectiveAnnualYield)}</strong>
                  <small className="mt-1 block text-xs text-white/30">{percent(projection.effectiveMonthlyRate)} mensual equivalente</small>
                </article>
              </div>

              {inflationRate > 0 && (
                <section className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-sm text-white/45">Valor real estimado</span>
                    <p className="mt-1 text-xs text-white/30">Poder de compra aproximado usando {percent(inflationRate)} de inflación anual.</p>
                  </div>
                  <strong className="text-lg font-medium text-white">{money(projection.realValue, currency)}</strong>
                </section>
              )}

              <section className="crystal-panel min-w-0 overflow-hidden">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-base font-medium text-white">Crecimiento del ahorro</h2>
                    <p className="mt-1 text-sm text-white/40">Compara tu capital aportado contra el saldo con rendimiento.</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-white/50">
                    <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-300" />Con interés</span>
                    <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-white/35" />Sólo aportaciones</span>
                  </div>
                </div>

                <div className="mt-5 min-w-0">
                  <div className="mb-2 flex items-center justify-between text-[11px] text-white/30">
                    <span>{money(chartMax, currency)}</span><span>Máximo proyectado</span>
                  </div>
                  <svg className="h-[260px] w-full overflow-visible" viewBox="0 0 760 260" preserveAspectRatio="none" role="img" aria-label="Gráfica comparativa del saldo con interés compuesto contra el capital aportado">
                    {[52, 104, 156, 208].map((y) => <line key={y} x1="0" x2="760" y1={y} y2={y} stroke="currentColor" className="text-white/[0.07]" strokeWidth="1" />)}
                    <polyline points={chartPoints(chartContributed)} fill="none" stroke="currentColor" className="text-white/30" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
                    <polyline points={chartPoints(chartBalance)} fill="none" stroke="currentColor" className="text-emerald-300" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <div className="mt-1 flex justify-between text-[11px] text-white/30">
                    <span>Hoy</span><span>Año {midpointYear}</span><span>Año {years}</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 border-t border-white/8 pt-4 sm:grid-cols-3">
                  <div className="flex items-center gap-2 rounded-xl bg-white/[0.025] p-3"><WalletCards size={16} className="text-white/35" /><div><small className="block text-xs text-white/35">Aportaciones</small><strong className="text-sm text-white">{money(projection.contributed, currency)}</strong></div></div>
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-300/[0.04] p-3"><TrendingUp size={16} className="text-emerald-200" /><div><small className="block text-xs text-emerald-100/40">Ganancia</small><strong className="text-sm text-emerald-200">{money(projection.interest, currency)}</strong></div></div>
                  <div className="flex items-center gap-2 rounded-xl bg-white/[0.025] p-3"><Sparkles size={16} className="text-white/35" /><div><small className="block text-xs text-white/35">Capitalización</small><strong className="text-sm text-white">{compoundingOptions.find((option) => option.value === compoundingFrequency)?.label}</strong></div></div>
                </div>
              </section>

              <section className="crystal-panel min-w-0">
                <div className="mb-4">
                  <h2 className="text-base font-medium text-white">Desglose por año</h2>
                  <p className="mt-1 text-sm text-white/40">Ve cómo el interés acumulado empieza a pesar más con el tiempo.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-white/35">
                        <th className="px-2 py-2 font-medium">Año</th>
                        <th className="px-2 py-2 font-medium">Aportado acumulado</th>
                        <th className="px-2 py-2 font-medium">Interés del año</th>
                        <th className="px-2 py-2 font-medium">Interés acumulado</th>
                        <th className="px-2 py-2 text-right font-medium">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projection.annual.map((row) => (
                        <tr key={row.year} className="border-b border-white/[0.06] text-white/65 last:border-0">
                          <td className="px-2 py-3 text-white/45">{row.year}</td>
                          <td className="px-2 py-3">{money(row.contributed, currency)}</td>
                          <td className="px-2 py-3 text-emerald-200/80">+{money(row.yearInterest, currency)}</td>
                          <td className="px-2 py-3 text-emerald-200/80">+{money(row.interest, currency)}</td>
                          <td className="px-2 py-3 text-right font-medium text-white">{money(row.balance, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="flex items-start gap-2 rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-xs leading-relaxed text-white/35">
                <CircleHelp size={15} className="mt-0.5 shrink-0" />
                <p>La proyección usa interés compuesto. Para aportaciones mensuales, la tasa nominal y la frecuencia elegida se convierten a una tasa mensual equivalente que conserva el rendimiento efectivo anual. Es una estimación: no incluye impuestos, comisiones ni cambios futuros en la tasa.</p>
              </section>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
