import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ExternalLink,
  FileSpreadsheet,
  Github,
  LockKeyhole,
  LogIn,
  Mail,
  Menu,
  MessageSquareMore,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CuantlyBrand } from './CuantlyBrand';
import { PublicReportForm } from './PublicReportForm';

const GITHUB_PROFILE_URL = 'https://github.com/marioibarrag';
const CONTACT_EMAIL = 'juanter@gmail.com';

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
    detail: 'Anota movimientos, organiza categorías y entiende tus decisiones con claridad.',
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
              <p>Billqo es un espacio simple para registrar, organizar y entender tus finanzas. Entras con Google y la información financiera permanece en tu propio Google Sheet.</p>

              <div className="crystal-landing-hero-actions">
                <button type="button" className="crystal-landing-primary-button" onClick={openAuth}>
                  Comenzar con Google
                  <ArrowRight size={18} />
                </button>
                <button type="button" className="crystal-landing-text-button" onClick={() => scrollTo('como-funciona')}>
                  Cómo funciona
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
              <p>Billqo crea o reutiliza un archivo de Google Sheets en tu Drive. No necesitas compartirlo con otra cuenta para usar la plataforma.</p>
              <div className="crystal-landing-sheet-flow" aria-label="Flujo de datos de Billqo">
                <div><LogIn size={17} /><span>Google confirma tu acceso</span></div>
                <i aria-hidden="true" />
                <div><FileSpreadsheet size={17} /><span>Tu Sheet guarda tus finanzas</span></div>
                <i aria-hidden="true" />
                <div><LockKeyhole size={17} /><span>Billqo trabaja con tu permiso</span></div>
              </div>
            </aside>
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
            <span>Creado por Mario Ibarra G</span>
            <a href={GITHUB_PROFILE_URL} target="_blank" rel="noreferrer">GitHub <ExternalLink size={13} /></a>
            <a href={`mailto:${CONTACT_EMAIL}`}><Mail size={13} />{CONTACT_EMAIL}</a>
            <a href="https://opensource.org/license/mit" target="_blank" rel="noreferrer">Licencia MIT <ExternalLink size={13} /></a>
            <button type="button" onClick={openPrivacy}>Privacidad</button>
            <button type="button" onClick={openTerms}>Términos</button>
          </div>
          <a className="crystal-landing-footer-github" href={GITHUB_PROFILE_URL} target="_blank" rel="noreferrer" aria-label="GitHub de Mario Ibarra G">
            <Github size={18} />
          </a>
        </footer>
      </div>

      {menuOpen && (
        <nav className="crystal-landing-menu" aria-label="Menú de Billqo">
          <button type="button" onClick={openAuth}>Iniciar sesión <ArrowRight size={16} /></button>
          <button type="button" onClick={() => scrollTo('como-funciona')}>Cómo funciona <ArrowDown size={16} /></button>
          <button type="button" onClick={() => scrollTo('reportar')}>Reportar <MessageSquareMore size={16} /></button>
          <button type="button" onClick={openPrivacy}>Privacidad <ArrowRight size={16} /></button>
          <button type="button" onClick={openTerms}>Términos <ArrowRight size={16} /></button>
        </nav>
      )}
    </div>
  );
};
