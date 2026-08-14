import React, { useMemo, useState } from 'react';
import { Calendar, ChevronDown, DollarSign, X } from 'lucide-react';
import type {
  Category,
  CostType,
  FixedVariable,
  Necessity,
  PaymentMethod,
  Transaction,
  TransactionType,
} from '../types';
import type { TransactionPayload } from '../lib/api';

interface AddTransactionModalProps {
  onClose: () => void;
  onSave: (payload: TransactionPayload) => Promise<void> | void;
  categories: Category[];
  transaction?: Transaction;
}

const paymentMethods: PaymentMethod[] = ['Efectivo', 'Tarjeta Débito', 'Tarjeta Crédito', 'Transferencia'];
const expenseCostTypes: CostType[] = ['Fijo', 'Variable', 'Discrecional', 'Operativo', 'Hormiga'];

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
  const [formError, setFormError] = useState<string>();

  const changeType = (nextType: TransactionType) => {
    setType(nextType);
    const nextCategory = categories.find((category) => category.active && category.type === nextType);
    setCategoryId(nextCategory?.id ?? '');
    setCostType(nextType === 'income' ? 'Ingreso' : 'Variable');
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

  return (
    <div className="crystal-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="crystal-modal crystal-transaction-sheet" role="dialog" aria-modal="true" aria-labelledby="new-transaction-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="crystal-modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        <header className="crystal-modal-header">
          <span className="crystal-eyebrow">{transaction ? 'Edición guardada en Google Sheets' : 'Registro rápido'}</span>
          <h2 id="new-transaction-title">{transaction ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
        </header>
        <form className="crystal-transaction-form" onSubmit={(event) => void submit(event)}>
          <div className="crystal-segmented">
            <button type="button" className={type === 'expense' ? 'is-active is-expense' : ''} onClick={() => changeType('expense')}>Gasto</button>
            <button type="button" className={type === 'income' ? 'is-active is-income' : ''} onClick={() => changeType('income')}>Ingreso</button>
          </div>
          <label className="crystal-field crystal-amount-field"><span>Monto</span><div><DollarSign size={18} /><input inputMode="decimal" autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div></label>
          <label className="crystal-field"><span>Descripción</span><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ej. Almuerzo" maxLength={240} /></label>
          <label className="crystal-field"><span>Categoría</span><div className="crystal-select-wrap"><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{filteredCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><ChevronDown size={16} /></div></label>
          <div className="crystal-form-grid">
            <label className="crystal-field"><span>Fecha</span><div className="crystal-input-icon-wrap"><Calendar size={16} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div></label>
            <label className="crystal-field"><span>Método</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
          </div>
          {type === 'expense' && <><div className="crystal-form-grid"><label className="crystal-field"><span>Fijo o variable</span><select value={fixedVariable} onChange={(event) => setFixedVariable(event.target.value as FixedVariable)}><option>Fijo</option><option>Variable</option></select></label><label className="crystal-field"><span>Necesidad</span><select value={necessity} onChange={(event) => setNecessity(event.target.value as Necessity)}><option>Necesario</option><option>Innecesario</option></select></label></div><label className="crystal-field"><span>Clasificación</span><select value={costType} onChange={(event) => setCostType(event.target.value as CostType)}>{expenseCostTypes.map((value) => <option key={value}>{value}</option>)}</select></label><fieldset className="crystal-influence-field"><legend>Influencia del impulso</legend><div className="crystal-influence-labels"><span>Planeado</span><span>Espontáneo</span></div><div className="crystal-influence-options">{([1, 2, 3, 4, 5] as const).map((value) => <button type="button" key={value} className={influence === value ? 'is-active' : ''} onClick={() => setInfluence(value)}>{value}</button>)}</div></fieldset></>}
          <label className="crystal-field"><span>Notas <em>opcional</em></span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={2000} /></label>
          {formError && <div className="crystal-alert crystal-alert-error" role="alert">{formError}</div>}
          <button className="crystal-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : transaction ? 'Guardar cambios' : 'Guardar movimiento'}</button>
          <button className="crystal-secondary-button" type="button" onClick={onClose}>Cancelar</button>
        </form>
      </section>
    </div>
  );
};
