import React from 'react';
import { ArrowLeft, Bot, FileSpreadsheet, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CuantlyBrand } from './CuantlyBrand';

const CONTACT_EMAIL = 'mario.ibago@gmail.com';
const LICENSE_URL = 'https://polyformproject.org/licenses/noncommercial/1.0.0';

export const TermsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="crystal-public-page crystal-privacy-page">
      <main className="crystal-privacy-public" aria-labelledby="terms-page-title">
        <header className="crystal-privacy-public-header">
          <CuantlyBrand />
          <button type="button" className="crystal-back-link" onClick={() => navigate('/')}>
            <ArrowLeft size={17} />
            Volver
          </button>
        </header>

        <section className="crystal-privacy-public-intro">
          <span className="crystal-eyebrow">Términos de uso</span>
          <h1 id="terms-page-title">Cómo funciona<br />Billqo.</h1>
          <p>Billqo es una herramienta para organizar finanzas personales y comprobantes. Al usarla, aceptas utilizar la aplicación de forma responsable y revisar la información que guardas.</p>
        </section>

        <div className="crystal-privacy-public-grid">
          <section className="crystal-panel crystal-privacy-public-card">
            <WalletCards size={19} />
            <h2>Organización financiera</h2>
            <p>Billqo permite registrar y consultar ingresos, gastos, categorías, presupuestos y preferencias. La aplicación muestra análisis basados en los datos que tú registras.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <FileSpreadsheet size={19} />
            <h2>Tu Google Sheet</h2>
            <p>Los registros financieros se guardan en el Google Sheet conectado dentro de tu Drive. Eres responsable de conservar el acceso a tu cuenta y de revisar los permisos que otorgas a Billqo.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <ReceiptText size={19} />
            <h2>Tickets y CFDI</h2>
            <p>El módulo de Facturación sirve para organizar comprobantes y relacionarlos con información fiscal o CFDI que ya exista. Billqo no timbra, emite ni cancela CFDI ante el SAT.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <Bot size={19} />
            <h2>Lectura automática</h2>
            <p>El escáner con IA puede sugerir datos a partir de una imagen, pero la extracción puede contener errores. Revisa monto, fecha, comercio, categoría y cualquier dato fiscal antes de guardarlo o usarlo para una decisión.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <ShieldCheck size={19} />
            <h2>Disponibilidad</h2>
            <p>Billqo depende de servicios externos como Google, Firebase, Vercel y el proveedor de IA configurado. Algunas funciones pueden verse temporalmente afectadas si alguno de esos servicios no está disponible.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <ShieldCheck size={19} />
            <h2>Código y licencia</h2>
            <p>
              El código de Billqo se ofrece bajo la PolyForm Noncommercial License 1.0.0. Los usos no comerciales permitidos por esa licencia pueden usar, estudiar, modificar y redistribuir el software; el uso comercial requiere un permiso o licencia adicional del autor. Consulta los <a href={LICENSE_URL} target="_blank" rel="noreferrer">términos completos de la licencia</a> o escribe a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> para solicitar autorización comercial.
            </p>
          </section>
        </div>

        <footer className="crystal-privacy-public-footer">
          <button type="button" className="crystal-legal-link" onClick={() => navigate('/privacy')}>Ver privacidad</button>
          <button type="button" className="crystal-primary-button" onClick={() => navigate('/auth')}>Entrar a Billqo</button>
        </footer>
      </main>
    </div>
  );
};
