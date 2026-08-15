import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  CircleHelp,
  ExternalLink,
  FileCode2,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import type {
  BillingIdentifier,
  BillingSnapshot,
  BillingTicketInput,
  BillingTicketStatus,
  FiscalProfile,
} from '../billingTypes';
import {
  createBillingTicket,
  getBillingSnapshot,
  importCfdiXml,
  saveBillingFiscalProfile,
  scanBillingTicket,
  updateBillingTicketStatus,
  uploadBillingTicketImage,
} from '../lib/billingApi';
import { CuantlyMark } from './CuantlyBrand';

type BillingTab = 'tickets' | 'profile' | 'cfdi' | 'legal';

interface BillingWorkspaceProps {
  onBack: () => void;
  spreadsheetUrl?: string;
}

interface TicketDraft {
  merchant: string;
  issuerRfc: string;
  date: string;
  time: string;
  total: string;
  subtotal: string;
  iva: string;
  currency: string;
  paymentMethod: string;
  cardLast4: string;
  invoiceUrl: string;
  qrData: string;
  notes: string;
  status: BillingTicketStatus;
  identifiers: BillingIdentifier[];
}

function today(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function emptyTicket(): TicketDraft {
  return {
    merchant: '', issuerRfc: '', date: today(), time: '', total: '', subtotal: '', iva: '', currency: 'MXN',
    paymentMethod: '', cardLast4: '', invoiceUrl: '', qrData: '', notes: '', status: 'pending', identifiers: [],
  };
}

function emptyProfile(): Omit<FiscalProfile, 'updatedAt'> {
  return { rfc: '', legalName: '', postalCode: '', taxRegime: '', cfdiUse: '', email: '' };
}

function money(amount: number, currency = 'MXN'): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function statusLabel(status: BillingTicketStatus): string {
  if (status === 'invoiced') return 'Facturada';
  if (status === 'not_required') return 'No necesito factura';
  return 'Pendiente';
}

function statusClass(status: BillingTicketStatus): string {
  if (status === 'invoiced') return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200';
  if (status === 'not_required') return 'border-white/10 bg-white/[0.04] text-white/45';
  return 'border-amber-300/20 bg-amber-300/10 text-amber-100';
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function safeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'No pudimos completar la operación.';
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[12px] font-semibold text-white/55">
      <span>{label}</span>
      {children}
      {hint && <small className="font-normal leading-5 text-white/30">{hint}</small>}
    </label>
  );
}

const inputClass = 'min-h-11 w-full rounded-xl border border-white/[0.10] bg-white/[0.045] px-3 text-[13px] font-medium text-white outline-none transition placeholder:text-white/20 focus:border-white/[0.24] focus:bg-white/[0.07]';

export function BillingWorkspace({ onBack, spreadsheetUrl }: BillingWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<BillingTab>('tickets');
  const [snapshot, setSnapshot] = useState<BillingSnapshot>();
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<TicketDraft>(emptyTicket);
  const [ticketImage, setTicketImage] = useState<File>();
  const [profileDraft, setProfileDraft] = useState<Omit<FiscalProfile, 'updatedAt'>>(emptyProfile);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const data = await getBillingSnapshot();
      setSnapshot(data);
      if (data.fiscalProfile) {
        const { updatedAt: _updatedAt, ...profile } = data.fiscalProfile;
        setProfileDraft(profile);
      }
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const counts = useMemo(() => ({
    pending: snapshot?.tickets.filter((ticket) => ticket.status === 'pending').length ?? 0,
    invoiced: snapshot?.tickets.filter((ticket) => ticket.status === 'invoiced').length ?? 0,
    total: snapshot?.tickets.length ?? 0,
  }), [snapshot]);

  const resetEditor = () => {
    setDraft(emptyTicket());
    setTicketImage(undefined);
    if (imageInputRef.current) imageInputRef.current.value = '';
    setEditorOpen(false);
  };

  const handleImage = async (file: File | undefined) => {
    if (!file) return;
    setTicketImage(file);
    setEditorOpen(true);
    setScanning(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const result = await scanBillingTicket(file);
      setDraft((current) => ({
        ...current,
        merchant: result.merchant ?? current.merchant,
        issuerRfc: result.issuerRfc ?? '',
        date: result.date ?? current.date,
        time: result.time ?? '',
        total: result.total === null ? '' : String(result.total),
        subtotal: result.subtotal === null ? '' : String(result.subtotal),
        iva: result.iva === null ? '' : String(result.iva),
        currency: result.currency ?? 'MXN',
        paymentMethod: result.paymentMethod ?? '',
        cardLast4: result.cardLast4 ?? '',
        identifiers: result.identifiers,
        invoiceUrl: result.invoiceUrl ?? '',
        qrData: result.qrData ?? '',
      }));
      setSuccess(result.confidence >= 0.8 ? 'Ticket leído. Revisa los campos antes de guardar.' : 'Lectura terminada. Revisa con cuidado los campos detectados.');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setScanning(false);
    }
  };

  const saveTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    const total = Number(draft.total);
    if (!draft.merchant.trim() || !draft.date || !Number.isFinite(total) || total < 0) {
      setError('Completa comercio, fecha y total antes de guardar.');
      return;
    }
    setBusy(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const image = ticketImage ? await uploadBillingTicketImage(ticketImage, ticketImage.name) : undefined;
      const payload: BillingTicketInput = {
        merchant: draft.merchant.trim(),
        issuerRfc: draft.issuerRfc.trim() || undefined,
        date: draft.date,
        time: draft.time.trim() || undefined,
        total,
        subtotal: optionalNumber(draft.subtotal),
        iva: optionalNumber(draft.iva),
        currency: draft.currency.trim().toUpperCase() || 'MXN',
        paymentMethod: draft.paymentMethod.trim() || undefined,
        cardLast4: draft.cardLast4.trim() || undefined,
        identifiers: draft.identifiers.filter((item) => item.key.trim() && item.value.trim()),
        invoiceUrl: safeHttpUrl(draft.invoiceUrl),
        qrData: draft.qrData.trim() || undefined,
        image,
        status: draft.status,
        notes: draft.notes.trim() || undefined,
      };
      await createBillingTicket(payload);
      resetEditor();
      await refresh();
      setSuccess('Ticket guardado en tu Google Sheet.');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      await saveBillingFiscalProfile({
        ...profileDraft,
        rfc: profileDraft.rfc.trim().toUpperCase(),
        legalName: profileDraft.legalName.trim(),
        postalCode: profileDraft.postalCode.trim(),
        taxRegime: profileDraft.taxRegime.trim(),
        cfdiUse: profileDraft.cfdiUse.trim().toUpperCase(),
        email: profileDraft.email?.trim() || undefined,
      });
      await refresh();
      setSuccess('Datos fiscales guardados en la hoja DATOS_FISCALES.');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (id: string, status: BillingTicketStatus) => {
    setBusy(true);
    setError(undefined);
    try {
      await updateBillingTicketStatus(id, status);
      await refresh();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const importXml = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const cfdi = await importCfdiXml(file, file.name, selectedTicketId || undefined);
      await refresh();
      setSuccess(`CFDI ${cfdi.uuid} importado y guardado en Drive.`);
      setActiveTab('cfdi');
      setSelectedTicketId('');
      if (xmlInputRef.current) xmlInputRef.current.value = '';
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const addIdentifier = () => setDraft((current) => ({ ...current, identifiers: [...current.identifiers, { key: '', value: '' }] }));
  const updateIdentifier = (index: number, field: 'key' | 'value', value: string) => setDraft((current) => ({
    ...current,
    identifiers: current.identifiers.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
  }));
  const removeIdentifier = (index: number) => setDraft((current) => ({ ...current, identifiers: current.identifiers.filter((_item, itemIndex) => itemIndex !== index) }));

  const tabs: Array<{ id: BillingTab; label: string }> = [
    { id: 'tickets', label: 'Tickets' },
    { id: 'profile', label: 'Datos fiscales' },
    { id: 'cfdi', label: 'CFDI' },
    { id: 'legal', label: 'Legal' },
  ];

  return (
    <div className="crystal-public-page min-h-screen">
      <div className="crystal-orb crystal-orb-a" aria-hidden="true" />
      <div className="crystal-orb crystal-orb-b" aria-hidden="true" />
      <main className="relative z-[1] mx-auto min-h-screen w-full max-w-[1180px] px-4 pb-20 pt-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" className="crystal-button crystal-button-ghost crystal-button-small" onClick={onBack}><ArrowLeft size={15} />Volver</button>
            <div className="hidden items-center gap-2 text-white/70 sm:flex"><CuantlyMark size={24} /><strong className="text-[13px]">Billqo</strong></div>
          </div>
          <div className="flex items-center gap-2">
            {spreadsheetUrl && <button type="button" className="crystal-button crystal-button-ghost crystal-button-small" onClick={() => window.open(spreadsheetUrl, '_blank', 'noopener,noreferrer')}><FileSpreadsheet size={14} />Abrir Sheet</button>}
            <button type="button" className="crystal-button crystal-button-ghost crystal-button-small" onClick={() => void refresh()} disabled={busy}><RefreshCw size={14} className={busy ? 'crystal-spin' : ''} />Sincronizar</button>
          </div>
        </header>

        <section className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="crystal-kicker">Compras · Tickets · CFDI</span>
            <h1 className="mt-1 text-[clamp(28px,5vw,46px)] font-semibold tracking-[-0.045em] text-white">Facturación</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-6 text-white/42">Guarda el ticket ahora y decide después si necesitas factura. Billqo organiza la información; no emite, timbra ni cancela CFDI.</p>
          </div>
          <button type="button" className="crystal-button crystal-button-primary" onClick={() => { setDraft(emptyTicket()); setTicketImage(undefined); setEditorOpen(true); }}><Plus size={15} />Nuevo ticket</button>
        </section>

        <div className="mb-5 grid grid-cols-3 gap-2 sm:max-w-xl">
          <div className="crystal-panel !p-3"><small className="block text-[10px] uppercase tracking-[0.12em] text-white/30">Guardados</small><strong className="mt-1 block text-xl text-white">{counts.total}</strong></div>
          <div className="crystal-panel !p-3"><small className="block text-[10px] uppercase tracking-[0.12em] text-amber-100/50">Pendientes</small><strong className="mt-1 block text-xl text-amber-100">{counts.pending}</strong></div>
          <div className="crystal-panel !p-3"><small className="block text-[10px] uppercase tracking-[0.12em] text-emerald-100/50">Facturadas</small><strong className="mt-1 block text-xl text-emerald-100">{counts.invoiced}</strong></div>
        </div>

        <nav className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Secciones de facturación">
          {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setError(undefined); setSuccess(undefined); }} className={`h-10 shrink-0 rounded-full border px-4 text-[12px] font-semibold transition ${activeTab === tab.id ? 'border-white/[0.24] bg-white/[0.12] text-white' : 'border-white/[0.08] bg-white/[0.025] text-white/42 hover:text-white/70'}`}>{tab.label}</button>)}
        </nav>

        {(error || success) && <div className={`mb-5 flex items-start gap-2 rounded-2xl border px-4 py-3 text-[12px] leading-5 ${error ? 'border-red-300/15 bg-red-300/[0.08] text-red-100' : 'border-emerald-300/15 bg-emerald-300/[0.08] text-emerald-100'}`}>{error ? <CircleHelp size={16} className="mt-0.5 shrink-0" /> : <Check size={16} className="mt-0.5 shrink-0" />}<span>{error ?? success}</span></div>}

        {activeTab === 'tickets' && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(330px,0.7fr)]">
            <section className="crystal-panel !p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5">
                <div><h2 className="text-[15px] font-semibold text-white">Inbox de compras</h2><p className="mt-0.5 text-[11px] text-white/32">El estado lo decides tú; importar XML solo agrega evidencia fiscal.</p></div>
                <label className="crystal-button crystal-button-ghost crystal-button-small cursor-pointer"><Camera size={14} />Tomar foto<input ref={imageInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void handleImage(event.target.files?.[0])} /></label>
              </div>
              {!snapshot && busy ? <div className="flex min-h-48 items-center justify-center text-white/40"><LoaderCircle size={22} className="crystal-spin" /></div> : snapshot?.tickets.length ? (
                <div className="divide-y divide-white/[0.055]">
                  {snapshot.tickets.map((ticket) => {
                    const invoiceUrl = safeHttpUrl(ticket.invoiceUrl);
                    return (
                      <article key={ticket.id} className="p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/60"><ReceiptText size={16} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-[13px] text-white">{ticket.merchant}</strong><small className="text-[11px] text-white/32">{ticket.date}{ticket.time ? ` · ${ticket.time}` : ''}{ticket.paymentMethod ? ` · ${ticket.paymentMethod}` : ''}</small></div><strong className="text-[14px] text-white">{money(ticket.total, ticket.currency)}</strong></div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(ticket.status)}`}>{statusLabel(ticket.status)}</span>{ticket.cfdiUuid && <span className="max-w-full truncate rounded-full border border-white/[0.08] px-2 py-1 font-mono text-[9px] text-white/35">UUID {ticket.cfdiUuid}</span>}</div>
                            {ticket.identifiers.length > 0 && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/30">{ticket.identifiers.slice(0, 5).map((item) => <span key={`${item.key}-${item.value}`}><b className="font-semibold text-white/45">{item.key}</b> {item.value}</span>)}</div>}
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <button type="button" className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-white/50 hover:text-white" disabled={busy || ticket.status === 'pending'} onClick={() => void changeStatus(ticket.id, 'pending')}>Pendiente</button>
                              <button type="button" className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-white/50 hover:text-white" disabled={busy || ticket.status === 'invoiced'} onClick={() => void changeStatus(ticket.id, 'invoiced')}>Facturada</button>
                              <button type="button" className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-white/50 hover:text-white" disabled={busy || ticket.status === 'not_required'} onClick={() => void changeStatus(ticket.id, 'not_required')}>No necesito</button>
                              {invoiceUrl && <button type="button" className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-white/50 hover:text-white" onClick={() => window.open(invoiceUrl, '_blank', 'noopener,noreferrer')}>Portal de facturación <ExternalLink size={10} className="inline" /></button>}
                              {ticket.image?.webViewUrl && <button type="button" className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-white/50 hover:text-white" onClick={() => window.open(ticket.image!.webViewUrl, '_blank', 'noopener,noreferrer')}>Ver foto</button>}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : <div className="grid min-h-52 place-items-center px-6 py-10 text-center"><div><ReceiptText size={24} className="mx-auto text-white/20" /><strong className="mt-3 block text-sm text-white/70">Aún no hay tickets</strong><p className="mt-1 text-[11px] leading-5 text-white/30">Toma una foto o captura los datos manualmente.</p></div></div>}
            </section>

            <section className="crystal-panel h-fit !p-4 sm:!p-5">
              <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-[15px] font-semibold text-white">{editorOpen ? 'Registrar ticket' : 'Captura rápida'}</h2><p className="mt-1 text-[11px] leading-5 text-white/32">La IA rellena campos; nada se guarda hasta que presionas Guardar.</p></div>{editorOpen && <button type="button" className="rounded-lg p-2 text-white/30 hover:bg-white/[0.05] hover:text-white/60" onClick={resetEditor}><X size={15} /></button>}</div>
              {!editorOpen ? <div className="grid gap-2"><label className="crystal-button crystal-button-primary cursor-pointer justify-center"><Camera size={15} />Tomar foto del ticket<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void handleImage(event.target.files?.[0])} /></label><button type="button" className="crystal-button crystal-button-ghost justify-center" onClick={() => setEditorOpen(true)}><Plus size={15} />Captura manual</button></div> : (
                <form className="grid gap-3" onSubmit={saveTicket}>
                  {scanning && <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-[11px] text-white/45"><Sparkles size={14} className="animate-pulse" />Leyendo ticket…</div>}
                  <div className="grid gap-3 sm:grid-cols-2"><Field label="Comercio"><input className={inputClass} value={draft.merchant} onChange={(event) => setDraft((current) => ({ ...current, merchant: event.target.value }))} placeholder="HEB" /></Field><Field label="RFC emisor"><input className={inputClass} value={draft.issuerRfc} onChange={(event) => setDraft((current) => ({ ...current, issuerRfc: event.target.value.toUpperCase() }))} placeholder="RFC del comercio" /></Field></div>
                  <div className="grid gap-3 sm:grid-cols-2"><Field label="Fecha"><input className={inputClass} type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></Field><Field label="Hora"><input className={inputClass} type="time" value={draft.time} onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))} /></Field></div>
                  <div className="grid grid-cols-3 gap-2"><Field label="Total"><input className={inputClass} type="number" min="0" step="0.01" value={draft.total} onChange={(event) => setDraft((current) => ({ ...current, total: event.target.value }))} placeholder="0.00" /></Field><Field label="Subtotal"><input className={inputClass} type="number" min="0" step="0.01" value={draft.subtotal} onChange={(event) => setDraft((current) => ({ ...current, subtotal: event.target.value }))} /></Field><Field label="IVA"><input className={inputClass} type="number" min="0" step="0.01" value={draft.iva} onChange={(event) => setDraft((current) => ({ ...current, iva: event.target.value }))} /></Field></div>
                  <div className="grid gap-3 sm:grid-cols-2"><Field label="Forma de pago"><input className={inputClass} value={draft.paymentMethod} onChange={(event) => setDraft((current) => ({ ...current, paymentMethod: event.target.value }))} placeholder="Tarjeta / Efectivo" /></Field><Field label="Últimos 4"><input className={inputClass} inputMode="numeric" maxLength={4} value={draft.cardLast4} onChange={(event) => setDraft((current) => ({ ...current, cardLast4: event.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="4821" /></Field></div>
                  <Field label="Identificadores del comercio" hint="No son obligatorios: ticket, folio, sucursal, caja, transacción, Web ID, etc."><div className="grid gap-2">{draft.identifiers.map((item, index) => <div key={index} className="grid grid-cols-[0.8fr_1.2fr_auto] gap-1.5"><input className={inputClass} value={item.key} onChange={(event) => updateIdentifier(index, 'key', event.target.value)} placeholder="ticket" /><input className={inputClass} value={item.value} onChange={(event) => updateIdentifier(index, 'value', event.target.value)} placeholder="928182" /><button type="button" className="grid h-11 w-10 place-items-center rounded-xl border border-white/[0.08] text-white/30 hover:text-white/60" onClick={() => removeIdentifier(index)}><X size={13} /></button></div>)}<button type="button" className="w-fit text-[10px] font-semibold text-white/40 hover:text-white/70" onClick={addIdentifier}><Plus size={11} className="inline" /> Agregar identificador</button></div></Field>
                  <Field label="URL de facturación"><input className={inputClass} type="url" value={draft.invoiceUrl} onChange={(event) => setDraft((current) => ({ ...current, invoiceUrl: event.target.value }))} placeholder="https://…" /></Field>
                  <Field label="Estado"><select className={inputClass} value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as BillingTicketStatus }))}><option value="pending">Pendiente</option><option value="invoiced">Ya está facturada</option><option value="not_required">No necesito factura</option></select></Field>
                  <Field label="Notas"><textarea className={`${inputClass} min-h-20 resize-y py-3`} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Opcional" /></Field>
                  <button type="submit" className="crystal-button crystal-button-primary justify-center" disabled={busy || scanning}>{busy ? <LoaderCircle size={15} className="crystal-spin" /> : <Save size={15} />}Guardar ticket</button>
                </form>
              )}
            </section>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(320px,0.5fr)]">
            <form className="crystal-panel grid gap-4 !p-5" onSubmit={saveProfile}>
              <div><span className="crystal-kicker">Una sola vez</span><h2 className="mt-1 text-xl font-semibold text-white">Mi perfil fiscal</h2><p className="mt-1 text-[11px] leading-5 text-white/34">Se guarda en la pestaña DATOS_FISCALES de tu propio Google Sheet para reutilizarlo al solicitar facturas.</p></div>
              <Field label="RFC"><input className={inputClass} value={profileDraft.rfc} onChange={(event) => setProfileDraft((current) => ({ ...current, rfc: event.target.value.toUpperCase() }))} placeholder="XAXX010101000" /></Field>
              <Field label="Nombre o razón social"><input className={inputClass} value={profileDraft.legalName} onChange={(event) => setProfileDraft((current) => ({ ...current, legalName: event.target.value }))} /></Field>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Código postal fiscal"><input className={inputClass} inputMode="numeric" maxLength={5} value={profileDraft.postalCode} onChange={(event) => setProfileDraft((current) => ({ ...current, postalCode: event.target.value.replace(/\D/g, '').slice(0, 5) }))} placeholder="64000" /></Field><Field label="Régimen fiscal"><input className={inputClass} inputMode="numeric" maxLength={3} value={profileDraft.taxRegime} onChange={(event) => setProfileDraft((current) => ({ ...current, taxRegime: event.target.value.replace(/\D/g, '').slice(0, 3) }))} placeholder="605" /></Field></div>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Uso CFDI"><input className={inputClass} value={profileDraft.cfdiUse} onChange={(event) => setProfileDraft((current) => ({ ...current, cfdiUse: event.target.value.toUpperCase().slice(0, 4) }))} placeholder="G03" /></Field><Field label="Correo (opcional)"><input className={inputClass} type="email" value={profileDraft.email ?? ''} onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} /></Field></div>
              <button type="submit" className="crystal-button crystal-button-primary w-fit" disabled={busy}><Save size={15} />Guardar datos fiscales</button>
            </form>
            <aside className="crystal-panel h-fit !p-5"><ShieldCheck size={19} className="text-emerald-200/70" /><h2 className="mt-3 text-[14px] font-semibold text-white">Datos mínimos para facturar</h2><p className="mt-2 text-[11px] leading-5 text-white/38">Billqo separa estos datos del historial financiero para que puedas copiarlos o reutilizarlos sin volver a capturarlos.</p><ul className="mt-4 grid gap-2 text-[11px] text-white/45"><li>RFC</li><li>Nombre o razón social</li><li>Código postal fiscal</li><li>Régimen fiscal</li><li>Uso CFDI</li><li>Correo: opcional</li></ul><a className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold text-white/45 hover:text-white/75" href="https://www.sat.gob.mx/minisitio/Factura/solicita_consideraciones.htm" target="_blank" rel="noreferrer">Consultar SAT <ExternalLink size={10} /></a></aside>
          </div>
        )}

        {activeTab === 'cfdi' && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="crystal-panel !p-0 overflow-hidden"><div className="border-b border-white/[0.06] px-5 py-4"><h2 className="text-[15px] font-semibold text-white">CFDI importados</h2><p className="mt-1 text-[11px] text-white/32">El XML se usa como fuente de verdad para los datos fiscales.</p></div>{snapshot?.cfdis.length ? <div className="divide-y divide-white/[0.055]">{snapshot.cfdis.map((cfdi) => <article key={cfdi.uuid} className="p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-300/10 bg-emerald-300/[0.07] text-emerald-200/70"><FileCode2 size={16} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><div><strong className="block text-[12px] text-white">{cfdi.issuerName || cfdi.issuerRfc}</strong><small className="text-[10px] text-white/30">{cfdi.issuedAt}</small></div><strong className="text-[13px] text-white">{money(cfdi.total, cfdi.currency || 'MXN')}</strong></div><p className="mt-2 truncate font-mono text-[9px] text-white/34">{cfdi.uuid}</p><div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/32"><span>Emisor {cfdi.issuerRfc}</span><span>Receptor {cfdi.receiverRfc}</span>{cfdi.cfdiUse && <span>Uso {cfdi.cfdiUse}</span>}</div>{cfdi.xml.webViewUrl && <button type="button" className="mt-3 text-[10px] font-semibold text-white/45 hover:text-white/75" onClick={() => window.open(cfdi.xml.webViewUrl, '_blank', 'noopener,noreferrer')}>Abrir XML en Drive <ExternalLink size={10} className="inline" /></button>}</div></div></article>)}</div> : <div className="grid min-h-52 place-items-center text-center"><div><FileCode2 size={24} className="mx-auto text-white/20" /><strong className="mt-3 block text-sm text-white/65">Sin CFDI importados</strong><p className="mt-1 text-[11px] text-white/30">Cuando recibas un XML CFDI 4.0, puedes guardarlo aquí.</p></div></div>}</section>
            <aside className="crystal-panel h-fit !p-5"><Upload size={19} className="text-white/55" /><h2 className="mt-3 text-[14px] font-semibold text-white">Importar XML CFDI 4.0</h2><p className="mt-1 text-[11px] leading-5 text-white/34">Billqo lee UUID, emisor, receptor, total, impuestos y datos principales. No modifica ni timbra el XML.</p><Field label="Relacionar con ticket (opcional)"><select className={`${inputClass} mt-3`} value={selectedTicketId} onChange={(event) => setSelectedTicketId(event.target.value)}><option value="">Sin relacionar</option>{snapshot?.tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.merchant} · {money(ticket.total, ticket.currency)} · {ticket.date}</option>)}</select></Field><label className="crystal-button crystal-button-primary mt-4 cursor-pointer justify-center"><Upload size={15} />Seleccionar XML<input ref={xmlInputRef} className="sr-only" type="file" accept="application/xml,text/xml,.xml" onChange={(event) => void importXml(event.target.files?.[0])} /></label><p className="mt-3 text-[10px] leading-4 text-white/25">El archivo se guarda en “Billqo - Comprobantes” dentro de tu Google Drive; la hoja CFDI conserva su ID/enlace y los campos estructurados.</p></aside>
          </div>
        )}

        {activeTab === 'legal' && (
          <div className="grid gap-4 md:grid-cols-2">
            <section className="crystal-panel !p-5"><ReceiptText size={19} className="text-white/55" /><h2 className="mt-3 text-[14px] font-semibold text-white">Qué hace Facturación</h2><p className="mt-2 text-[11px] leading-5 text-white/40">Organiza tickets, conserva identificadores del comercio, guarda tu perfil fiscal y permite importar CFDI XML que ya recibiste.</p><p className="mt-2 text-[11px] leading-5 text-white/40"><strong className="text-white/65">No es un PAC ni un servicio del SAT.</strong> Billqo no emite, timbra, cancela ni sustituye facturas.</p></section>
            <section className="crystal-panel !p-5"><FileSpreadsheet size={19} className="text-white/55" /><h2 className="mt-3 text-[14px] font-semibold text-white">Dónde se guarda</h2><p className="mt-2 text-[11px] leading-5 text-white/40">Tickets, datos fiscales y campos CFDI se guardan en las pestañas TICKETS, DATOS_FISCALES y CFDI de tu Google Sheet. Fotos y XML se guardan como archivos en tu Google Drive.</p><p className="mt-2 text-[11px] leading-5 text-white/40"><strong className="text-white/65">No se guardan estos registros fiscales o financieros en Firebase/Firestore.</strong> Firebase sigue usándose únicamente para autenticar tu identidad y sesión de Billqo.</p></section>
            <section className="crystal-panel !p-5"><Sparkles size={19} className="text-white/55" /><h2 className="mt-3 text-[14px] font-semibold text-white">Análisis de la foto</h2><p className="mt-2 text-[11px] leading-5 text-white/40">La foto solo se envía al servicio de análisis cuando tú eliges escanear un ticket. La solicitud se configura para evitar proveedores que declaren recopilar datos mediante el parámetro de privacidad disponible en OpenRouter.</p><p className="mt-2 text-[11px] leading-5 text-white/40">Revisa siempre los campos detectados: el OCR/IA puede equivocarse y no reemplaza el XML de un CFDI.</p></section>
            <section className="crystal-panel !p-5"><ShieldCheck size={19} className="text-white/55" /><h2 className="mt-3 text-[14px] font-semibold text-white">Minimización de datos</h2><p className="mt-2 text-[11px] leading-5 text-white/40">No captures números completos de tarjeta, CVV ni credenciales. Billqo solo contempla los últimos cuatro dígitos visibles como referencia de la compra.</p><div className="mt-3 flex flex-wrap gap-3"><a className="text-[10px] font-semibold text-white/45 hover:text-white/75" href="https://www.sat.gob.mx/minisitio/Factura/solicita_consideraciones.htm" target="_blank" rel="noreferrer">Consideraciones SAT <ExternalLink size={10} className="inline" /></a><a className="text-[10px] font-semibold text-white/45 hover:text-white/75" href="https://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" target="_blank" rel="noreferrer">Estructura CFDI 4.0 <ExternalLink size={10} className="inline" /></a></div></section>
          </div>
        )}
      </main>
    </div>
  );
}
