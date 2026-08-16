import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Camera,
  Download,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  Github,
  LockKeyhole,
  LogIn,
  Mail,
  Menu,
  MessageSquareMore,
  ReceiptText,
  Search,
  ShieldCheck,
  Tags,
  WalletCards,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../landing-seo.css';
import { CuantlyBrand } from './CuantlyBrand';
import { PublicReportForm } from './PublicReportForm';

const GITHUB_PROFILE_URL = 'https://github.com/MarioIbago';
const CONTACT_EMAIL = 'mario.ibago@gmail.com';

const howItWorks = [
  {
    icon: LogIn,
    title: 'Entra con Google',
    detail: 'Inicia sesión con la cuenta que quieres usar para tu espacio financiero.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Conecta tu Sheet',
    detail: 'Billqo crea o reutiliza un archivo privado dentro de tu propio Drive.',
  },
  {
    icon: ShieldCheck,
    title: 'Registra y analiza',
    detail: 'Anota movimientos, organiza categorías, revisa presupuestos y entiende tus decisiones con claridad.',
  },
] as const;

const features = [
  {
    icon: WalletCards,
    title: 'Ingresos y gastos',
    detail: 'Registra tus movimientos con fecha, categoría, método de pago y descripción. Edita, busca y organiza tu historial financiero cuando lo necesites.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard y análisis',
    detail: 'Consulta balance, ingresos, gastos, tendencias y distribución por categoría para entender mejor cómo se mueve tu dinero.',
  },
  {
    icon: Tags,
    title: 'Presupuestos y categorías',
    detail: 'Define un presupuesto mensual y límites por categoría para comparar lo planeado con tus gastos reales.',
  },
  {
    icon: Search,
    title: 'Búsqueda y filtros',
    detail: 'Encuentra movimientos por texto, periodo, categoría o tipo para revisar rápidamente una compra, ingreso o gasto específico.',
  },
  {
    icon: Camera,
    title: 'Tickets con IA',
    detail: 'Toma una foto de un ticket y Billqo puede extraer comercio, fecha, total, RFC y datos útiles para ayudarte a registrar y organizar la compra.',
  },
  {
    icon: ReceiptText,
    title: 'Control de facturación',
    detail: 'Guarda tickets pendientes, facturados o que no necesitas facturar. Conserva tus datos fiscales y relaciona cada compra con su CFDI cuando exista.',
  },
  {
    icon: FileCheck2,
    title: 'CFDI y XML',
    detail: 'Importa el XML de un CFDI 4.0, conserva su UUID y datos fiscales y úsalo como la referencia definitiva de la factura recibida.',
  },
  {
    icon: Download,
    title: 'Exportación y control',
    detail: 'Tus registros viven en tu Google Sheet y puedes conservar, revisar y exportar tu información sin depender de una base financiera cerrada.',
  },
] as const;

const faqs = [
  {
    question: '¿Para qué sirve Billqo?',
    answer: 'Billqo es una app de finanzas personales para registrar ingresos y gastos, controlar presupuestos, organizar categorías, analizar movimientos y llevar seguimiento de tickets y facturas desde una sola interfaz.',
  },
  {
    question: '¿Dónde se guarda mi información financiera?',
    answer: 'Tus movimientos, presupuestos y datos financieros se guardan en un Google Sheet dentro de tu propio Google Drive. Billqo usa Firebase para autenticación y metadata técnica, no como base de datos de tus movimientos financieros.',
  },
  {
    question: '¿Puedo usar Billqo desde distintos dispositivos?',
    answer: 'Sí. Al iniciar sesión con tu cuenta de Google puedes acceder a tu espacio financiero desde computadora o celular y trabajar con la misma información guardada en tu Google Sheet.',
  },
  {
    question: '¿Billqo emite facturas?',
    answer: 'No. Billqo no timbra ni emite CFDI. El módulo de facturación sirve para organizar tickets, guardar datos fiscales, marcar compras como facturadas e importar el XML de una factura que ya fue emitida.',
  },
] as const;

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const openAuth = () => {
    setMenuOpen(false);
    navigate('/auth');
  };

  const openPrivacy = () => {
    setMenuOpen(false);
    navigate('/privacy');
  };

  const openTerms = () => {
    setMenuOpen(false);
    navigate('/terms');
  };

  const scrollTo = (sectionId: string) => {
    setMenuOpen(false);
    const section = document.getElementById(sectionId);
    if (!section) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className="crystal-public-page crystal-landing-page crystal-landing-screen">
      <div className="crystal-orb crystal-orb-a" aria-hidden="true" />
      <div className="crystal-orb crystal-orb-b" aria-hidden="true" />

      <div className="crystal-landing-shell">
        <header className="crystal-landing-header">
          <CuantlyBrand />
          <nav className="crystal-landing-nav" aria-label="Navegación principal">
            <button type="button" onClick={() => scrollTo('funciones')}>Funciones</button>
            <button type="button" onClick={() => scrollTo('como-funciona')}>Cómo funciona</button>
            <button type="button" onClick={() => scrollTo('reportar')}>Reportar</button>
            <button type="button" className="crystal-landing-login-button" onClick={openAuth}>
              Iniciar sesión
              <ArrowRight size={16} />
            </button>
          </nav>
          <button
            type="button"
            className="crystal-landing-menu-button"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </header>

        <main>
          <section className="crystal-landing-hero" aria-labelledby="landing-title">
            <div className="crystal-landing-hero-copy">
              <h1 id="landing-title">Tu dinero, claro<br />y bajo tu control.</h1>
              <p>Tu información financiera, disponible en todos tus dispositivos de forma segura. Registra ingresos y gastos, crea presupuestos y entiende tus finanzas personales desde un solo lugar.</p>

              <div className="crystal-landing-hero-actions">
                <button type="button" className="crystal-landing-primary-button" onClick={openAuth}>
                  Comenzar con Google
                  <ArrowRight size={18} />
                </button>
                <button type="button" className="crystal-landing-text-button" onClick={() => scrollTo('funciones')}>
                  Ver funciones
                  <ArrowDown size={16} />
                </button>
              </div>
            </div>

            <aside className="crystal-landing-sheet-card" aria-label="Cómo protege Billqo tu información">
              <div className="crystal-landing-sheet-card-head">
                <span><FileSpreadsheet size={17} /> Tu espacio financiero</span>
                <ShieldCheck size={18} aria-hidden="true" />
              </div>
              <h2>Tu Sheet, tus datos.</h2>
              <p>Billqo crea o reutiliza un archivo de Google Sheets en tu Drive. Tus movimientos financieros permanecen en un documento que tú controlas.</p>
              <div className="crystal-landing-sheet-flow" aria-label="Flujo de datos de Billqo">
                <div><LogIn size={17} /><span>Google confirma tu acceso</span></div>
                <i aria-hidden="true" />
                <div><FileSpreadsheet size={17} /><span>Tu Sheet guarda tus finanzas</span></div>
                <i aria-hidden="true" />
                <div><LockKeyhole size={17} /><span>Billqo trabaja con tu permiso</span></div>
              </div>
            </aside>
          </section>

          <section id="funciones" className="crystal-landing-section crystal-landing-features" aria-labelledby="features-title">
            <div className="crystal-landing-section-copy crystal-landing-feature-heading">
              <h2 id="features-title">Tus finanzas personales, en un solo lugar.</h2>
              <p>Controla gastos, ingresos y presupuestos; analiza tus hábitos, organiza tickets y conserva tus facturas sin perder la propiedad de tus datos.</p>
            </div>

            <div className="crystal-landing-feature-grid">
              {features.map(({ icon: Icon, title, detail }) => (
                <article key={title} className="crystal-landing-feature">
                  <span className="crystal-landing-feature-icon" aria-hidden="true"><Icon size={20} /></span>
                  <div>
                    <h3>{title}</h3>
                    <p>{detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="como-funciona" className="crystal-landing-section crystal-landing-how" aria-labelledby="how-it-works-title">
            <div className="crystal-landing-section-copy">
              <h2 id="how-it-works-title">Así de simple.</h2>
              <p>La plataforma separa la autenticación de tus registros financieros para que puedas tener un espacio propio, claro y fácil de mantener.</p>
            </div>

            <ol className="crystal-landing-steps">
              {howItWorks.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="crystal-landing-step">
                  <span className="crystal-landing-step-icon"><Icon size={21} /></span>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="crystal-landing-section crystal-landing-faq" aria-labelledby="faq-title">
            <div className="crystal-landing-section-copy crystal-landing-faq-heading">
              <h2 id="faq-title">Preguntas sobre Billqo.</h2>
              <p>Lo esencial sobre control de gastos, almacenamiento, acceso desde distintos dispositivos y el módulo de facturación.</p>
            </div>
            <div className="crystal-landing-faq-list">
              {faqs.map(({ question, answer }) => (
                <details key={question} className="crystal-landing-faq-item">
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section id="reportar" className="crystal-landing-report" aria-labelledby="report-title">
            <div className="crystal-landing-report-copy">
              <MessageSquareMore size={22} aria-hidden="true" />
              <h2 id="report-title">¿Encontraste algo que no funciona?</h2>
              <p>Cuéntanos qué pasó o comparte una idea. Cada reporte llega a Firebase de forma protegida para que podamos revisarlo.</p>
              <small>Tu correo es opcional y solo se usa si hace falta responderte sobre este reporte.</small>
            </div>
            <PublicReportForm />
          </section>
        </main>

        <footer className="crystal-landing-footer">
          <CuantlyBrand compact />
          <div className="crystal-landing-footer-links" aria-label="Enlaces de Billqo">
            <span>Creado por Mario Ibarra Gómez</span>
            <a href={GITHUB_PROFILE_URL} target="_blank" rel="noreferrer">GitHub <ExternalLink size={13} /></a>
            <a href={`mailto:${CONTACT_EMAIL}`}><Mail size={13} />{CONTACT_EMAIL}</a>
            <a href="https://polyformproject.org/licenses/noncommercial/1.0.0" target="_blank" rel="noreferrer">Licencia no comercial <ExternalLink size={13} /></a>
            <button type="button" onClick={openPrivacy}>Privacidad</button>
            <button type="button" onClick={openTerms}>Términos</button>
          </div>
          <a className="crystal-landing-footer-github" href={GITHUB_PROFILE_URL} target="_blank" rel="noreferrer" aria-label="GitHub de MarioIbago">
            <Github size={18} />
          </a>
        </footer>
      </div>

      {menuOpen && (
        <nav className="crystal-landing-menu" aria-label="Menú de Billqo">
          <button type="button" onClick={openAuth}>Iniciar sesión <ArrowRight size={16} /></button>
          <button type="button" onClick={() => scrollTo('funciones')}>Funciones <WalletCards size={16} /></button>
          <button type="button" onClick={() => scrollTo('como-funciona')}>Cómo funciona <ArrowDown size={16} /></button>
          <button type="button" onClick={() => scrollTo('reportar')}>Reportar <MessageSquareMore size={16} /></button>
          <button type="button" onClick={openPrivacy}>Privacidad <ArrowRight size={16} /></button>
          <button type="button" onClick={openTerms}>Términos <ArrowRight size={16} /></button>
        </nav>
      )}
    </div>
  );
};
