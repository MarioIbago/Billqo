import React from 'react';
import { ArrowLeft, FileText, ShieldCheck, UserCheck, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CuantlyBrand } from './CuantlyBrand';

export const TermsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="crystal-public-page crystal-privacy-page">
      <div className="crystal-orb crystal-orb-a" aria-hidden="true" />
      <div className="crystal-orb crystal-orb-b" aria-hidden="true" />

      <main className="crystal-privacy-public" aria-labelledby="terms-page-title">
        <header className="crystal-privacy-public-header">
          <CuantlyBrand />
          <button type="button" className="crystal-back-link" onClick={() => navigate('/auth')}>
            <ArrowLeft size={17} />
            Iniciar sesión
          </button>
        </header>

        <section className="crystal-privacy-public-intro">
          <span className="crystal-eyebrow">Uso responsable</span>
          <h1 id="terms-page-title">Términos de uso<br />de Billqo.</h1>
          <p>Al usar Billqo aceptas estos términos. La aplicación te ayuda a organizar información financiera; no sustituye asesoría financiera, fiscal, legal o contable profesional.</p>
        </section>

        <div className="crystal-privacy-public-grid">
          <section className="crystal-panel crystal-privacy-public-card">
            <UserCheck size={19} />
            <h2>Tu cuenta</h2>
            <p>El acceso se realiza con la cuenta de Google que eliges. Eres responsable de proteger tu cuenta de Google y de usar Billqo solo con información sobre la que tengas derecho de acceso.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <WalletCards size={19} />
            <h2>Tus datos financieros</h2>
            <p>Los movimientos, presupuestos y preferencias que registres pertenecen a ti y se guardan en el Google Sheet de tu Drive. Puedes editarlos, exportarlos, desconectar la integración o eliminarlos desde la aplicación.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <ShieldCheck size={19} />
            <h2>Acceso a Google</h2>
            <p>La autorización se limita al archivo de Billqo que conectas o creas. Puedes revocar el acceso de Google en cualquier momento; al hacerlo, Billqo deja de sincronizar y tu archivo permanece en tu Drive.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <FileText size={19} />
            <h2>Disponibilidad y cambios</h2>
            <p>Podemos actualizar Billqo o estos términos para mejorar la seguridad y el servicio. Si un cambio afecta de forma importante el uso de tus datos, se reflejará en esta página antes de aplicar.</p>
          </section>
        </div>

        <footer className="crystal-privacy-public-footer">
          <button type="button" className="crystal-legal-link" onClick={() => navigate('/privacy')}>Leer privacidad y control de datos</button>
          <button type="button" className="crystal-primary-button" onClick={() => navigate('/auth')}>Continuar a Billqo</button>
        </footer>
      </main>
    </div>
  );
};
