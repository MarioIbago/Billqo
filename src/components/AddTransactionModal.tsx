import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Camera,
  ChevronDown,
  DollarSign,
  FolderOpen,
  Images,
  LoaderCircle,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import type {
  Category,
  CostType,
  FixedVariable,
  Necessity,
  PaymentMethod,
  ReceiptScanResult,
  Transaction,
  TransactionType,
} from '../types';
import { scanReceipt, type TransactionPayload } from '../lib/api';
import { prepareReceiptImage } from '../lib/receiptImage';

interface AddTransactionModalProps {
  onClose: () => void;
  onSave: (payload: TransactionPayload) => Promise<void> | void;
  categories: Category[];
  transaction?: Transaction;
}

const paymentMethods: PaymentMethod[] = ['Efectivo', 'Tarjeta Débito', 'Tarjeta Crédito', 'Transferencia'];
const expenseCostTypes: CostType[] = ['Fijo', 'Variable', 'Discrecional', 'Operativo', 'Hormiga'];
const mobileImageFileTypes = '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif';
const MAX_TEXT_LENGTH = 200;
const MAX_AMOUNT = 999_999_999_999.99;
const amountInputPattern = /^\d{0,12}(?:\.\d{0,2})?$/;
const forbiddenControls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const labelClass = 'mb-1.5 block text-[12px] font-semibold tracking-[0.01em] text-white/55';
const glassControl = 'border border-white/[0.13] bg-white/[0.065] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl';
const controlClass = `h-11 w-full min-w-0 max-w-full rounded-[15px] ${glassControl} px-3 text-[16px] text-white outline-none transition focus:border-white/25 focus:bg-white/[0.095] disabled:opacity-50`;
const selectClass = `${controlClass} appearance-none pr-9`;

function normalizeCategory(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es-MX');
}

function safeSingleLine(value: string): string {
  return value.replace(forbiddenControls, '').replace(/[\r\n]+/g, ' ').slice(0, MAX_TEXT_LENGTH);
}

function safeNotes(value: string): string {
  return value.replace(forbiddenControls, '').slice(0, MAX_TEXT_LENGTH);
}

function normalizeAmountInput(value: string): string | undefined {
  const normalized = value.replace(',', '.').trim();
  if (normalized === '' || amountInputPattern.test(normalized)) return normalized;
  return undefined;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ onClose, onSave, categories, transaction }) => {
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense');
  const filteredCategories = useMemo(
    () => categories.filter((category) => category.active && category.type === type),
    [categories, type],
  );
  const [categoryId, setCategoryId] = useState<string>(() => transaction?.categoryId ?? categories.find((category) => category.active && category.type === (transaction?.type ?? 'expense'))?.id ?? '');
  const [description, setDescription] = useState(safeSingleLine(transaction?.description ?? ''));
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
  const [date, setDate] = useState(transaction?.date ?? new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(transaction?.paymentMethod ?? 'Tarjeta Débito');
  const [costType, setCostType] = useState<CostType>(transaction?.costType ?? 'Variable');
  const [fixedVariable, setFixedVariable] = useState<FixedVariable>(transaction?.fixedVariable ?? 'Variable');
  const [necessity, setNecessity] = useState<Necessity>(transaction?.necessity ?? 'Necesario');
  const [influence, setInfluence] = useState<1 | 2 | 3 | 4 | 5>(transaction?.influence ?? 3);
  const [notes, setNotes] = useState(safeNotes(transaction?.notes ?? ''));
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [receiptSourcesOpen, setReceiptSourcesOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overflowX = previousHtmlOverflowX;
    };
  }, []);

  const changeType = (nextType: TransactionType) => {
    setType(nextType);
    const nextCategory = categories.find((category) => category.active && category.type === nextType);
    setCategoryId(nextCategory?.id ?? '');
    setCostType(nextType === 'income' ? 'Ingreso' : 'Variable');
    setScanMessage(undefined);
    setReceiptSourcesOpen(false);
  };

  const applyReceiptResult = (result: ReceiptScanResult) => {
    setType(result.type);
    const resultCategories = categories.filter((category) => category.active && category.type === result.type);
    const category = result.category
      ? resultCategories.find((candidate) => normalizeCategory(candidate.name) === normalizeCategory(result.category!))
      : undefined;
    setCategoryId(category?.id ?? '');

    if (result.amount !== null && result.amount <= MAX_AMOUNT) setAmount(String(result.amount));
    if (result.description) setDescription(safeSingleLine(result.description));
    else if (result.merchant) setDescription(safeSingleLine(result.merchant));
    if (result.date) setDate(result.date);
    if (result.paymentMethod) setPaymentMethod(result.paymentMethod);

    if (result.type === 'income') {
      setCostType('Ingreso');
    } else {
      if (result.costType && result.costType !== 'Ingreso') setCostType(result.costType);
      if (result.fixedVariable) setFixedVariable(result.fixedVariable);
      if (result.necessity) setNecessity(result.necessity);
      if (result.influence) setInfluence(result.influence);
    }

    const confidence = Math.round(result.confidence * 100);
    const warning = result.warnings[0];
    setScanMessage(warning
      ? `Comprobante analizado (${confidence}% de confianza). ${warning}`
      : `Comprobante analizado (${confidence}% de confianza). Revisa los datos antes de guardar.`);
  };

  const handleReceiptFile = async (file: File) => {
    setFormError(undefined);
    setScanMessage(undefined);
    setReceiptSourcesOpen(false);
    try {
      setScanning(true);
      const prepared = await prepareReceiptImage(file);
      const allowedCategories = categories
        .filter((category) => category.active && category.type === type)
        .map((category) => category.name);
      const result = await scanReceipt(prepared, type, allowedCategories);
      applyReceiptResult(result);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No pudimos analizar el comprobante. Puedes registrar el movimiento manualmente.');
    } finally {
      setScanning(false);
    }
  };

  const handleReceiptSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (file) void handleReceiptFile(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(undefined);
    const numericAmount = Number(amount);
    const selectedCategory = filteredCategories.find((category) => category.id === categoryId);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > MAX_AMOUNT) {
      setFormError('Ingresa un monto válido mayor que cero.');
      return;
    }
    if (!description.trim()) {
      setFormError('Agrega una descripción.');
      return;
    }
    if (description.length > MAX_TEXT_LENGTH || notes.length > MAX_TEXT_LENGTH) {
      setFormError('Descripción y notas admiten un máximo de 200 caracteres.');
      return;
    }
    if (!selectedCategory) {
      setFormError('Selecciona una categoría válida.');
      return;
    }
    const payload: TransactionPayload = {
      type,
      amount: numericAmount,
      description: description.trim(),
      categoryId: selectedCategory.id,
      category: selectedCategory.name,
      costType: type === 'income' ? 'Ingreso' : costType,
      fixedVariable: type === 'expense' ? fixedVariable : undefined,
      necessity: type === 'expense' ? necessity : undefined,
      influence: type === 'expense' ? influence : undefined,
      date,
      paymentMethod,
      notes: notes.trim() || undefined,
      recurring: transaction?.recurring ?? false,
    };
    try {
      setSaving(true);
      await onSave(payload);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No pudimos guardar el movimiento.');
    } finally {
      setSaving(false);
    }
  };

  const renderSelect = (
    value: string,
    onChange: (value: string) => void,
    options: Array<{ value: string; label: string }>,
    placeholder?: string,
  ) => (
    <div className="relative min-w-0">
      <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
    </div>
  );

  const advancedSummary = type === 'expense'
    ? `${fixedVariable} · ${necessity} · ${costType} · impulso ${influence}`
    : notes.trim() ? 'Con notas' : 'Notas y detalles opcionales';

  return (
    <div
      className="fixed inset-0 z-[80] flex min-w-0 items-end justify-center overflow-hidden bg-black/45 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-[14px] sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="relative flex w-full min-w-0 max-w-[410px] flex-col overflow-hidden rounded-[28px] border border-white/[0.16] text-white shadow-[0_24px_80px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-[30px] backdrop-saturate-[175%]"
        style={{
          maxHeight: 'min(86dvh, 760px)',
          background: 'linear-gradient(180deg, rgba(28,28,30,0.78) 0%, rgba(9,9,10,0.70) 100%)',
          WebkitBackdropFilter: 'blur(30px) saturate(175%)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-transaction-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex flex-none items-start justify-between gap-3 border-b border-white/[0.08] bg-white/[0.025] px-4 pb-3 pt-3.5 backdrop-blur-2xl">
          <div className="min-w-0">
            <span className="block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
              {transaction ? 'Editar en Google Sheets' : 'Registro rápido'}
            </span>
            <h2 id="new-transaction-title" className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.03em] text-white">
              {transaction ? 'Editar movimiento' : 'Nuevo movimiento'}
            </h2>
          </div>
          <button
            type="button"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-[14px] ${glassControl} text-white/65 transition active:scale-95`}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void submit(event)} autoComplete="off">
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3.5 pb-3 pt-3 sm:px-4">
            <div className="flex min-w-0 flex-col gap-3">
              <div className={`grid h-11 grid-cols-2 gap-1 rounded-[16px] p-1 ${glassControl}`}>
                <button
                  type="button"
                  className={`min-w-0 rounded-[12px] text-[14px] font-semibold transition active:scale-[0.99] ${type === 'expense' ? 'bg-[#cf545a]/90 text-white shadow-[0_6px_20px_rgba(207,84,90,0.20)] backdrop-blur-xl' : 'text-white/50'}`}
                  onClick={() => changeType('expense')}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  className={`min-w-0 rounded-[12px] text-[14px] font-semibold transition active:scale-[0.99] ${type === 'income' ? 'bg-[#35986d]/90 text-white shadow-[0_6px_20px_rgba(53,152,109,0.20)] backdrop-blur-xl' : 'text-white/50'}`}
                  onClick={() => changeType('income')}
                >
                  Ingreso
                </button>
              </div>

              {!transaction && (
                <>
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleReceiptSelection} />
                  <input ref={photosInputRef} type="file" accept="image/*" hidden onChange={handleReceiptSelection} />
                  <input ref={filesInputRef} type="file" accept={mobileImageFileTypes} hidden onChange={handleReceiptSelection} />

                  <button
                    type="button"
                    className={`flex h-11 min-w-0 items-center gap-2.5 rounded-[15px] px-3 text-[14px] font-semibold text-white/70 transition active:scale-[0.99] disabled:opacity-50 ${glassControl}`}
                    disabled={scanning || saving}
                    onClick={() => setReceiptSourcesOpen((open) => !open)}
                    aria-expanded={receiptSourcesOpen}
                  >
                    {scanning ? <LoaderCircle className="shrink-0 animate-spin" size={17} /> : <Upload className="shrink-0" size={17} />}
                    <span className="truncate">{scanning ? 'Analizando comprobante…' : 'Agregar comprobante'}</span>
                    {!scanning && <ChevronDown className={`ml-auto shrink-0 transition-transform ${receiptSourcesOpen ? 'rotate-180' : ''}`} size={15} />}
                  </button>

                  {receiptSourcesOpen && !scanning && (
                    <div className={`grid grid-cols-3 gap-1.5 rounded-[20px] p-2 ${glassControl}`} role="group" aria-label="Origen del comprobante">
                      {[
                        { label: 'Cámara', icon: Camera, onClick: () => cameraInputRef.current?.click() },
                        { label: 'Fotos', icon: Images, onClick: () => photosInputRef.current?.click() },
                        { label: 'Archivos', icon: FolderOpen, onClick: () => filesInputRef.current?.click() },
                      ].map(({ label, icon: Icon, onClick }) => (
                        <button
                          type="button"
                          key={label}
                          className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] border border-white/[0.08] bg-white/[0.035] px-1.5 py-2.5 text-white/70 transition active:scale-95"
                          onClick={onClick}
                        >
                          <Icon size={18} />
                          <span className="text-[11px] font-semibold">{label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {scanMessage && (
                    <p className="m-0 rounded-[14px] border border-white/[0.09] bg-white/[0.045] px-3 py-2 text-[11px] leading-4.5 text-white/55 backdrop-blur-xl" role="status">
                      {scanMessage}
                    </p>
                  )}
                </>
              )}

              <label className="block min-w-0">
                <span className={labelClass}>Monto</span>
                <div className={`flex h-[54px] min-w-0 items-center rounded-[17px] px-3 transition focus-within:border-white/25 focus-within:bg-white/[0.10] ${glassControl}`}>
                  <DollarSign className="mr-1.5 shrink-0 text-white/35" size={19} />
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent text-[24px] font-medium tracking-[-0.02em] text-white outline-none placeholder:text-white/20"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]{0,2}"
                    maxLength={15}
                    value={amount}
                    onChange={(event) => {
                      const next = normalizeAmountInput(event.target.value);
                      if (next !== undefined) setAmount(next);
                    }}
                    placeholder="0.00"
                    aria-label="Monto"
                    autoComplete="off"
                    enterKeyHint="next"
                  />
                </div>
              </label>

              <label className="block min-w-0">
                <span className="mb-1.5 flex items-center justify-between gap-2 text-[12px] font-semibold tracking-[0.01em] text-white/55">
                  <span>Descripción</span>
                  <span className="text-[10px] font-medium tabular-nums text-white/28">{description.length}/{MAX_TEXT_LENGTH}</span>
                </span>
                <input
                  className={controlClass}
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(safeSingleLine(event.target.value))}
                  placeholder="Descripción del movimiento"
                  maxLength={MAX_TEXT_LENGTH}
                  autoComplete="off"
                  enterKeyHint="next"
                  spellCheck
                />
              </label>

              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(132px,0.82fr)] gap-2.5 max-[350px]:grid-cols-1">
                <label className="block min-w-0">
                  <span className={labelClass}>Categoría</span>
                  {renderSelect(
                    categoryId,
                    setCategoryId,
                    filteredCategories.map((category) => ({ value: category.id, label: category.name })),
                    'Selecciona',
                  )}
                </label>

                <label className="block min-w-0">
                  <span className={labelClass}>Fecha</span>
                  <div className={`flex h-11 min-w-0 items-center rounded-[15px] px-2.5 transition focus-within:border-white/25 ${glassControl}`}>
                    <Calendar className="mr-1.5 shrink-0 text-white/35" size={15} />
                    <input
                      className="h-full min-w-0 flex-1 appearance-none bg-transparent text-[16px] text-white outline-none [color-scheme:dark]"
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </label>
              </div>

              <label className="block min-w-0">
                <span className={labelClass}>Método</span>
                {renderSelect(
                  paymentMethod,
                  (value) => setPaymentMethod(value as PaymentMethod),
                  paymentMethods.map((method) => ({ value: method, label: method })),
                )}
              </label>

              <button
                type="button"
                className={`flex min-h-12 min-w-0 items-center gap-2.5 rounded-[17px] px-3 py-2.5 text-left transition active:scale-[0.995] ${glassControl}`}
                onClick={() => setAdvancedOpen((open) => !open)}
                aria-expanded={advancedOpen}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] bg-white/[0.07] text-white/55">
                  <SlidersHorizontal size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[13px] font-semibold text-white/75">Más configuración</strong>
                  <span className="block truncate text-[10.5px] text-white/38">{advancedSummary}</span>
                </span>
                <ChevronDown className={`shrink-0 text-white/40 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} size={16} />
              </button>

              {advancedOpen && (
                <div className={`min-w-0 rounded-[20px] p-3 ${glassControl}`}>
                  <div className="flex min-w-0 flex-col gap-3">
                    {type === 'expense' && (
                      <>
                        <div className="grid min-w-0 grid-cols-2 gap-2.5 max-[350px]:grid-cols-1">
                          <label className="block min-w-0">
                            <span className={labelClass}>Tipo</span>
                            {renderSelect(
                              fixedVariable,
                              (value) => setFixedVariable(value as FixedVariable),
                              ['Fijo', 'Variable'].map((value) => ({ value, label: value })),
                            )}
                          </label>
                          <label className="block min-w-0">
                            <span className={labelClass}>Necesidad</span>
                            {renderSelect(
                              necessity,
                              (value) => setNecessity(value as Necessity),
                              ['Necesario', 'Innecesario'].map((value) => ({ value, label: value })),
                            )}
                          </label>
                        </div>

                        <label className="block min-w-0">
                          <span className={labelClass}>Clasificación</span>
                          {renderSelect(
                            costType,
                            (value) => setCostType(value as CostType),
                            expenseCostTypes.map((value) => ({ value, label: value })),
                          )}
                        </label>

                        <fieldset className="min-w-0 rounded-[16px] border border-white/[0.08] bg-black/[0.08] p-2.5">
                          <legend className="px-1 text-[11px] font-semibold text-white/50">Influencia del impulso</legend>
                          <div className="mb-2 flex items-center justify-between text-[9.5px] font-medium text-white/30">
                            <span>Planeado</span>
                            <span>Espontáneo</span>
                          </div>
                          <div className="grid min-w-0 grid-cols-5 gap-1.5">
                            {([1, 2, 3, 4, 5] as const).map((value) => (
                              <button
                                type="button"
                                key={value}
                                className={`h-9 min-w-0 rounded-[11px] border text-[14px] font-semibold transition active:scale-95 ${influence === value ? 'border-white/80 bg-white/90 text-black shadow-[0_5px_16px_rgba(255,255,255,0.09)]' : 'border-white/[0.08] bg-white/[0.025] text-white/45'}`}
                                onClick={() => setInfluence(value)}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                      </>
                    )}

                    <label className="block min-w-0">
                      <span className="mb-1.5 flex items-center justify-between gap-2 text-[12px] font-semibold tracking-[0.01em] text-white/55">
                        <span>Notas <em className="font-normal not-italic text-white/28">opcional</em></span>
                        <span className="text-[10px] font-medium tabular-nums text-white/28">{notes.length}/{MAX_TEXT_LENGTH}</span>
                      </span>
                      <textarea
                        className={`min-h-[66px] w-full min-w-0 max-w-full resize-none rounded-[15px] px-3 py-2.5 text-[16px] leading-5 text-white outline-none transition focus:border-white/25 focus:bg-white/[0.095] ${glassControl}`}
                        value={notes}
                        onChange={(event) => setNotes(safeNotes(event.target.value))}
                        rows={2}
                        maxLength={MAX_TEXT_LENGTH}
                        autoComplete="off"
                        spellCheck
                      />
                    </label>
                  </div>
                </div>
              )}

              {formError && (
                <div className="rounded-[15px] border border-red-400/20 bg-red-400/[0.08] px-3 py-2.5 text-[12px] leading-4.5 text-red-100 backdrop-blur-xl" role="alert">
                  {formError}
                </div>
              )}
            </div>
          </div>

          <footer
            className="flex flex-none gap-2 border-t border-white/[0.08] bg-white/[0.025] px-3.5 pt-2.5 backdrop-blur-2xl sm:px-4"
            style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
          >
            <button
              className="h-11 min-w-0 flex-1 rounded-[15px] border border-white/70 bg-white/90 px-3 text-[14px] font-bold text-black shadow-[0_8px_24px_rgba(255,255,255,0.07),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl transition active:scale-[0.99] disabled:opacity-50"
              type="submit"
              disabled={saving || scanning}
            >
              {saving ? 'Guardando…' : transaction ? 'Guardar cambios' : 'Guardar movimiento'}
            </button>
            <button
              className={`h-11 shrink-0 rounded-[15px] px-3 text-[13px] font-semibold text-white/50 transition active:scale-[0.99] disabled:opacity-50 ${glassControl}`}
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};