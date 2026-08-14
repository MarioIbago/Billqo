import React from 'react';
import { ArrowLeft, FileSpreadsheet, LockKeyhole, ShieldCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CuantlyBrand } from './CuantlyBrand';

export const PrivacyPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="crystal-public-page crystal-privacy-page">
      <div className="crystal-orb crystal-orb-a" aria-hidden="true" />
      <div className="crystal-orb crystal-orb-b" aria-hidden="true" />

      <main className="crystal-privacy-public" aria-labelledby="privacy-page-title">
        <header className="crystal-privacy-public-header">
          <CuantlyBrand />
          <button type="button" className="crystal-back-link" onClick={() => navigate('/auth')}>
            <ArrowLeft size={17} />
            Iniciar sesión
          </button>
        </header>

        <section className="crystal-privacy-public-intro">
          <span className="crystal-eyebrow">Transparencia</span>
          <h1 id="privacy-page-title">Tu información,<br />bajo tu control.</h1>
          <p>Billqo separa la autenticación de tus finanzas: Firebase confirma quién eres y tu información financiera permanece en tu propio Google Sheet.</p>
        </section>

        <div className="crystal-privacy-public-grid">
          <section className="crystal-panel crystal-privacy-public-card">
            <ShieldCheck size={19} />
            <h2>Lo que recabamos</h2>
            <ul>
              <li>Datos básicos de tu cuenta de Firebase: identificador, correo, nombre, foto y proveedor de acceso.</li>
              <li>Metadatos técnicos de la conexión: estado, identificador/URL del Sheet y última sincronización.</li>
              <li>Los registros financieros que tú decides guardar en el Sheet: movimientos, categorías, presupuestos, recurrentes y preferencias.</li>
              <li>Los reportes de soporte que nos envías: tipo, descripción y correo de contacto solo si decides proporcionarlo.</li>
            </ul>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <LockKeyhole size={19} />
            <h2>Lo que no recabamos</h2>
            <ul>
              <li>No recabamos tu contraseña de Google; el acceso se realiza exclusivamente con la cuenta Google que eliges.</li>
              <li>Movimientos financieros dentro de Firebase; ahí solo viven metadatos técnicos de la conexión OAuth.</li>
              <li>Archivos de Drive ajenos a la autorización que tú concediste para el archivo de Billqo.</li>
            </ul>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <FileSpreadsheet size={19} />
            <h2>Tu Google Sheet</h2>
            <p>Cuando conectas Google, Billqo crea o reutiliza un archivo en tu Drive. El archivo es tuyo y no se comparte con una cuenta de Firebase ni con una cuenta de servicio.</p>
            <p>El token de renovación se cifra en el servidor y no se guarda en el navegador ni en localStorage.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card crystal-privacy-public-danger">
            <Trash2 size={19} />
            <h2>Desconectar o borrar</h2>
            <p><strong>Desconectar Google</strong> revoca el acceso de Billqo y elimina la metadata de conexión, pero deja intacto tu archivo en Drive.</p>
            <p><strong>Borrar datos del Sheet</strong> elimina permanentemente movimientos, presupuestos y recurrentes desde la app. Las categorías y la configuración se conservan solo para que el documento siga siendo utilizable.</p>
            <p>Para eliminar el archivo completo, ábrelo en Google Drive y muévelo a la papelera.</p>
          </section>
        </div>

        <footer className="crystal-privacy-public-footer">
          <button type="button" className="crystal-legal-link" onClick={() => navigate('/terms')}>Leer términos de uso</button>
          <button type="button" className="crystal-primary-button" onClick={() => navigate('/auth')}>Continuar a Billqo</button>
        </footer>
      </main>
    </div>
  );
};
