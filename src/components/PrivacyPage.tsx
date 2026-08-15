import React from 'react';
import { ArrowLeft, FileSpreadsheet, LockKeyhole, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
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
          <p>Billqo separa la autenticación de tus datos: Firebase confirma quién eres; tus finanzas, tickets, datos fiscales y registros CFDI permanecen en archivos de tu propio Google Drive.</p>
        </section>

        <div className="crystal-privacy-public-grid">
          <section className="crystal-panel crystal-privacy-public-card">
            <ShieldCheck size={19} />
            <h2>Lo que recabamos</h2>
            <ul>
              <li>Datos básicos de tu cuenta de Firebase: identificador, correo, nombre, foto y proveedor de acceso.</li>
              <li>Metadatos técnicos de la conexión: estado, identificador/URL del Sheet y última sincronización.</li>
              <li>Los registros financieros que decides guardar: movimientos, categorías, presupuestos, recurrentes y preferencias.</li>
              <li>Si usas Facturación: tickets, identificadores del comercio, perfil fiscal y campos extraídos de CFDI que tú decidas registrar.</li>
              <li>Los reportes de soporte que nos envías: tipo, descripción y correo de contacto solo si decides proporcionarlo.</li>
            </ul>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <LockKeyhole size={19} />
            <h2>Lo que no guardamos en Firebase</h2>
            <ul>
              <li>No recabamos tu contraseña de Google; el acceso se realiza exclusivamente con la cuenta Google que eliges.</li>
              <li>No guardamos movimientos, tickets, RFC, perfil fiscal, CFDI, fotos de tickets ni XML de facturas en Firebase/Firestore.</li>
              <li>Firebase se utiliza para autenticar tu identidad y para la metadata técnica necesaria para mantener la conexión segura.</li>
              <li>No solicitamos números completos de tarjeta ni CVV. El módulo de tickets contempla únicamente últimos cuatro dígitos visibles como referencia.</li>
            </ul>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <FileSpreadsheet size={19} />
            <h2>Google Sheets y Drive</h2>
            <p>Cuando conectas Google, Billqo crea o reutiliza un archivo en tu Drive. Tus movimientos se mantienen en ese Sheet y, si usas Facturación, se agregan las pestañas TICKETS, DATOS_FISCALES y CFDI.</p>
            <p>Las fotos de tickets y XML CFDI que decidas conservar se guardan en una carpeta de tu Google Drive llamada “Billqo - Comprobantes”. El Sheet conserva referencias a esos archivos.</p>
            <p>El token de renovación se cifra en el servidor y no se guarda en el navegador ni en localStorage.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <Sparkles size={19} />
            <h2>Análisis de tickets</h2>
            <p>Si eliges analizar una foto, Billqo la envía al servicio de IA configurado únicamente para proponer campos como comercio, fecha, total e identificadores de facturación. La imagen no se guarda como registro de Billqo hasta que tú decides guardar el ticket.</p>
            <p>La integración solicita a OpenRouter evitar proveedores que declaren recopilar datos mediante su opción de privacidad <code>data_collection: deny</code>. El tratamiento técnico por proveedores externos se rige también por sus políticas aplicables.</p>
            <p>La lectura automática puede equivocarse. Debes revisar los campos antes de guardarlos y, cuando exista un CFDI, el XML importado se utiliza como fuente de los campos fiscales.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card crystal-privacy-public-danger">
            <Trash2 size={19} />
            <h2>Desconectar o borrar</h2>
            <p><strong>Desconectar Google</strong> revoca el acceso de Billqo y elimina la metadata de conexión, pero deja intactos tus archivos en Drive.</p>
            <p><strong>Borrar datos financieros</strong> elimina los registros contemplados por esa acción en el Sheet. Los archivos que tú conserves en Drive siguen bajo el control de tu cuenta.</p>
            <p>Para eliminar el Sheet o la carpeta de comprobantes por completo, puedes hacerlo directamente desde Google Drive.</p>
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
