import React, { useState, type FormEvent } from 'react';
import { LoaderCircle, Send } from 'lucide-react';
import {
  FinancialApiError,
  submitPublicReport,
  type PublicReportCategory,
} from '../lib/api';

const reportTypes: Array<{ value: PublicReportCategory; label: string }> = [
  { value: 'bug', label: 'Algo no funciona' },
  { value: 'idea', label: 'Sugerencia o idea' },
  { value: 'other', label: 'Otro' },
];

type ReportFeedback = { kind: 'error' | 'success'; text: string } | undefined;

export const PublicReportForm: React.FC = () => {
  const [category, setCategory] = useState<PublicReportCategory>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<ReportFeedback>();

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedMessage = message.trim();

    if (normalizedMessage.length < 12) {
      setFeedback({ kind: 'error', text: 'Cuéntanos un poco más para poder entender el reporte.' });
      return;
    }

    setSending(true);
    setFeedback(undefined);
    try {
      await submitPublicReport({
        category,
        message: normalizedMessage,
        email: email.trim() || undefined,
        website,
      });
      setMessage('');
      setEmail('');
      setWebsite('');
      setFeedback({ kind: 'success', text: 'Gracias. Tu reporte se guardó y lo revisaremos.' });
    } catch (error) {
      setFeedback({
        kind: 'error',
        text: error instanceof FinancialApiError
          ? error.message
          : 'No pudimos enviar el reporte. Inténtalo de nuevo en un momento.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="crystal-report-form" onSubmit={submitReport} noValidate>
      <div className="crystal-report-form-fields">
        <label htmlFor="report-type">
          Tipo de reporte
          <select
            id="report-type"
            value={category}
            onChange={(event) => setCategory(event.target.value as PublicReportCategory)}
            disabled={sending}
          >
            {reportTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>

        <label htmlFor="report-email">
          Tu correo <span>(opcional)</span>
          <input
            id="report-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={320}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Para poder responderte"
            disabled={sending}
          />
        </label>
      </div>

      <label htmlFor="report-message" className="crystal-report-message-field">
        Cuéntanos qué pasó
        <textarea
          id="report-message"
          required
          minLength={12}
          maxLength={2000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Describe el problema o tu sugerencia con el mayor detalle posible…"
          disabled={sending}
        />
      </label>

      <label className="crystal-report-honeypot" aria-hidden="true">
        Sitio web
        <input
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </label>

      {feedback && (
        <p className={`crystal-report-feedback is-${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </p>
      )}

      <div className="crystal-report-form-actions">
        <button type="submit" className="crystal-landing-outline-button" disabled={sending}>
          {sending ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
          {sending ? 'Enviando…' : 'Enviar reporte'}
        </button>
        <small>Se guarda de forma segura en Firebase.</small>
      </div>
    </form>
  );
};
