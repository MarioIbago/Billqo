import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Camera, ChevronDown, DollarSign, FolderOpen, Images, LoaderCircle, Upload, X } from 'lucide-react';
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

const labelClass = 'mb-1.5 block text-[13px] font-semibold tracking-[0.01em] text-white/60';
const controlClass = 'h-12 w-full min-w-0 max-w-full rounded-2xl border border-white/[0.11] bg-white/[0.035] px-3.5 text-[16px] text-white outline-none transition focus:border-white/25 focus:bg-white/[0.055] disabled:opacity-50';
const selectClass = `${controlClass} appearance-none pr-10`;

function normalizeCategory(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es-MX');
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ onClose, onSave, categories, transaction }) => {
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense');
  const filteredCategories = useMemo(
    () => categories.filter((category) => category.active && category.type === type),
    [categories, type],
  );
  const [categoryId, setCategoryId] = useState<string>(() => transaction?.categoryId ?? categories.find((category) => category.active && category.type === (transaction?.type ?? 'expense'))?.id ?? '');
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
  const [date, setDate] = useState(transaction?.date ?? new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(transaction?.paymentMethod ?? 'Tarjeta Débito');
  const [costType, setCostType] = useState<CostType>(transaction?.costType ?? 'Variable');
  const [fixedVariable, setFixedVariable] = useState<FixedVariable>(transaction?.fixedVariable ?? 'Variable');
  const [necessity, setNecessity] = useState<Necessity>(transaction?.necessity ?? 'Necesario');
  const [influence, setInfluence] = useState<1 | 2 | 3 | 4 | 5>(transaction?.influence ?? 3);
  const [notes, setNotes] = useState(transaction?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [receiptSourcesOpen, setReceiptSourcesOpen] = useState(false);
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

    if (result.amount !== null) setAmount(String(result.amount));
    if (result.description) setDescription(result.description);
    else if (result.merchant) setDescription(result.merchant);
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
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('Ingresa un monto mayor que cero.');
      return;
    }
    if (!description.trim()) {
      setFormError('Agrega una descripción.');
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
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-white/45" size={17} />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex min-w-0 items-end justify-center overflow-hidden bg-black/75 backdrop-blur-md sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="relative flex w-full min-w-0 max-w-[430px] flex-col overflow-hidden rounded-t-[28px] border border-white/[0.10] bg-[#0b0b0c] text-white shadow-[0_-20px_60px_rgba(0,0,0,0.55)] sm:max-h-[88dvh] sm:rounded-[28px]"
        style={{ maxHeight: 'min(94dvh, 860px)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-transaction-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-white/[0.07] bg-[#0b0b0c]/95 px-4 pb-3 pt-4 backdrop-blur-xl sm:px-5">
          <div className="min-w-0">
            <span className="block truncate text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
              {transaction ? 'Edición guardada en Google Sheets' : 'Registro rápido'}
            </span>
            <h2 id="new-transaction-title" className="mt-1.5 text-[24px] font-semibold leading-tight tracking-[-0.03em] text-white">
              {transaction ? 'Editar movimiento' : 'Nuevo movimiento'}
            </h2>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/[0.10] bg-white/[0.04] text-white/70 transition active:scale-95"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void submit(event)}>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-4 pt-3 sm:px-5">
            <div className="flex min-w-0 flex-col gap-3.5">
              <div className="grid h-12 grid-cols-2 gap-1 rounded-2xl border border-white/[0.10] bg-white/[0.035] p-1">
                <button
                  type="button"
                  className={`min-w-0 rounded-xl text-[15px] font-semibold transition active:scale-[0.99] ${type === 'expense' ? 'bg-[#d25056] text-white shadow-[0_6px_20px_rgba(210,80,86,0.22)]' : 'text-white/55'}`}
                  onClick={() => changeType('expense')}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  className={`min-w-0 rounded-xl text-[15px] font-semibold transition active:scale-[0.99] ${type === 'income' ? 'bg-[#2d9b69] text-white shadow-[0_6px_20px_rgba(45,155,105,0.22)]' : 'text-white/55'}`}
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
                    className="flex h-12 min-w-0 items-center justify-center gap-2.5 rounded-2xl border border-white/[0.13] bg-white/[0.055] px-3 text-[15px] font-semibold text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl transition active:scale-[0.99] disabled:opacity-50"
                    disabled={scanning || saving}
                    onClick={() => setReceiptSourcesOpen((open) => !open)}
                    aria-expanded={receiptSourcesOpen}
                  >
                    {scanning ? <LoaderCircle className="shrink-0 animate-spin" size={18} /> : <Upload className="shrink-0" size={18} />}
                    <span className="truncate">{scanning ? 'Analizando comprobante…' : 'Agregar comprobante'}</span>
                    {!scanning && <ChevronDown className={`ml-auto shrink-0 transition-transform ${receiptSourcesOpen ? 'rotate-180' : ''}`} size={16} />}
                  </button>

                  {receiptSourcesOpen && !scanning && (
                    <div
                      className="grid grid-cols-3 gap-2 rounded-[22px] border border-white/[0.14] bg-white/[0.065] p-2.5 shadow-[0_14px_40px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl"
                      role="group"
                      aria-label="Origen del comprobante"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.10] bg-white/[0.045] px-2 py-3 text-white/75 transition active:scale-95"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.08]"><Camera size={19} /></span>
                        <span className="text-[13px] font-semibold">Cámara</span>
                      </button>
                      <button
                        type="button"
                        className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.10] bg-white/[0.045] px-2 py-3 text-white/75 transition active:scale-95"
                        onClick={() => photosInputRef.current?.click()}
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.08]"><Images size={19} /></span>
                        <span className="text-[13px] font-semibold">Fotos</span>
                      </button>
                      <button
                        type="button"
                        className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.10] bg-white/[0.045] px-2 py-3 text-white/75 transition active:scale-95"
                        onClick={() => filesInputRef.current?.click()}
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.08]"><FolderOpen size={19} /></span>
                        <span className="text-[13px] font-semibold">Archivos</span>
                      </button>
                    </div>
                  )}

                  {scanMessage && <p className="m-0 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[12px] leading-5 text-white/55" role="status">{scanMessage}</p>}
                </>
              )}

              <label className="block min-w-0">
                <span className={labelClass}>Monto</span>
                <div className="flex h-[58px] min-w-0 items-center rounded-2xl border border-white/[0.12] bg-white/[0.04] px-3.5 transition focus-within:border-white/25 focus-within:bg-white/[0.055]">
                  <DollarSign className="mr-2 shrink-0 text-white/40" size={20} />
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent text-[25px] font-medium tracking-[-0.02em] text-white outline-none placeholder:text-white/25"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    aria-label="Monto"
                  />
                </div>
              </label>

              <label className="block min-w-0">
                <span className={labelClass}>Descripción</span>
                <input
                  className={controlClass}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Descripción del movimiento"
                  maxLength={240}
                />
              </label>

              <div className="grid min-w-0 grid-cols-2 gap-3">
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
                  <div className="flex h-12 min-w-0 items-center rounded-2xl border border-white/[0.11] bg-white/[0.035] px-3 transition focus-within:border-white/25">
                    <Calendar className="mr-2 shrink-0 text-white/40" size={16} />
                    <input
                      className="h-full min-w-0 flex-1 appearance-none bg-transparent text-[16px] text-white outline-none [color-scheme:dark]"
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
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

              {type === 'expense' && (
                <>
                  <div className="grid min-w-0 grid-cols-2 gap-3">
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

                  <fieldset className="min-w-0 rounded-2xl border border-white/[0.10] bg-white/[0.025] p-3.5">
                    <legend className="px-1 text-[13px] font-semibold text-white/60">Influencia del impulso</legend>
                    <div className="mb-2.5 flex items-center justify-between text-[11px] font-medium text-white/35">
                      <span>Planeado</span>
                      <span>Espontáneo</span>
                    </div>
                    <div className="grid min-w-0 grid-cols-5 gap-2">
                      {([1, 2, 3, 4, 5] as const).map((value) => (
                        <button
                          type="button"
                          key={value}
                          className={`h-11 min-w-0 rounded-xl border text-[16px] font-semibold transition active:scale-95 ${influence === value ? 'border-white bg-white text-black shadow-[0_5px_18px_rgba(255,255,255,0.12)]' : 'border-white/[0.09] bg-transparent text-white/50'}`}
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
                <span className={labelClass}>Notas <em className="font-normal not-italic text-white/30">opcional</em></span>
                <textarea
                  className="min-h-[76px] w-full min-w-0 max-w-full resize-none rounded-2xl border border-white/[0.11] bg-white/[0.035] px-3.5 py-3 text-[16px] leading-5 text-white outline-none transition focus:border-white/25 focus:bg-white/[0.055]"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  maxLength={2000}
                />
              </label>

              {formError && (
                <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.08] px-3.5 py-3 text-[13px] leading-5 text-red-100" role="alert">
                  {formError}
                </div>
              )}
            </div>
          </div>

          <footer
            className="flex flex-none gap-2.5 border-t border-white/[0.08] bg-[#0b0b0c]/95 px-4 pt-3 backdrop-blur-xl sm:px-5"
            style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}
          >
            <button
              className="h-13 min-w-0 flex-1 rounded-2xl bg-white px-4 text-[16px] font-bold text-black shadow-[0_8px_28px_rgba(255,255,255,0.08)] transition active:scale-[0.99] disabled:opacity-50"
              type="submit"
              disabled={saving || scanning}
            >
              {saving ? 'Guardando…' : transaction ? 'Guardar cambios' : 'Guardar movimiento'}
            </button>
            <button
              className="h-13 shrink-0 rounded-2xl border border-white/[0.10] bg-white/[0.035] px-4 text-[15px] font-semibold text-white/55 transition active:scale-[0.99] disabled:opacity-50"
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
