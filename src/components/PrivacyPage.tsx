import React from 'react';
import { ArrowLeft, Bot, FileSpreadsheet, KeyRound, MessageSquareMore, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CuantlyBrand } from './CuantlyBrand';

export const PrivacyPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="crystal-public-page crystal-privacy-page">
      <main className="crystal-privacy-public" aria-labelledby="privacy-page-title">
        <header className="crystal-privacy-public-header">
          <CuantlyBrand />
          <button type="button" className="crystal-back-link" onClick={() => navigate('/')}>
            <ArrowLeft size={17} />
            Volver
          </button>
        </header>

        <section className="crystal-privacy-public-intro">
          <span className="crystal-eyebrow">Privacidad</span>
          <h1 id="privacy-page-title">Tus datos financieros<br />siguen en tu espacio.</h1>
          <p>Billqo usa servicios distintos para iniciar sesión, mantener la conexión y trabajar con tus registros. Esta página describe lo que hace la aplicación actualmente, sin atribuirle funciones o garantías que no ofrece.</p>
        </section>

        <div className="crystal-privacy-public-grid">
          <section className="crystal-panel crystal-privacy-public-card">
            <ShieldCheck size={19} />
            <h2>Cuenta y conexión</h2>
            <p>Firebase se utiliza para autenticar tu sesión. Billqo conserva metadata técnica necesaria para operar la conexión con Google, como su estado, el identificador del Sheet, permisos concedidos y la última sincronización.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <FileSpreadsheet size={19} />
            <h2>Finanzas y facturación</h2>
            <p>Tus movimientos, categorías, presupuestos y preferencias se trabajan desde el Google Sheet conectado en tu Drive.</p>
            <p>Si usas Facturación, Billqo añade al mismo archivo las secciones necesarias para tickets, datos fiscales y CFDI. Los archivos que decidas conservar, como imágenes o XML, se guardan en tu Google Drive.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <KeyRound size={19} />
            <h2>Acceso a Google</h2>
            <p>Billqo usa la autorización que concedes para crear, leer y actualizar los archivos que administra para la aplicación. El token persistente de Google se cifra en el servidor y no se expone al navegador.</p>
            <p>Puedes desconectar Google desde Billqo. Tus archivos permanecen en Drive hasta que tú los elimines desde tu cuenta.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <Bot size={19} />
            <h2>Escaneo con IA</h2>
            <p>Cuando eliges analizar una imagen de un comprobante, Billqo envía esa imagen al proveedor de IA configurado para proponer campos del registro. La lectura puede equivocarse, por lo que debes revisar los datos antes de guardarlos.</p>
            <p>La solicitud del escáner pide a OpenRouter evitar proveedores que declaren recopilar datos mediante la opción técnica <code>data_collection: deny</code>.</p>
          </section>

          <section className="crystal-panel crystal-privacy-public-card">
            <MessageSquareMore size={19} />
            <h2>Reportes de soporte</h2>
            <p>Si envías un reporte desde la página pública, Billqo guarda el tipo y el texto del reporte. El correo solo se incluye cuando tú decides proporcionarlo para recibir seguimiento.</p>
          </section>
        </div>

        <footer className="crystal-privacy-public-footer">
          <button type="button" className="crystal-legal-link" onClick={() => navigate('/terms')}>Ver términos de uso</button>
          <button type="button" className="crystal-primary-button" onClick={() => navigate('/auth')}>Entrar a Billqo</button>
        </footer>
      </main>
    </div>
  );
};
