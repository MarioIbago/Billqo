const fs = require('fs');

const authCode = `
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { ArrowLeft, ArrowRight, BarChart3, Check, FileSpreadsheet, LockKeyhole, ShieldCheck } from 'lucide-react';
import { auth } from '../lib/firebase';
import { getConnection, startGoogleAuthorization } from '../lib/api';
import { CuantlyBrand, CuantlyMark } from './CuantlyBrand';

function AuthPreview() {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 hidden md:block">
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Tu archivo</span>
          <strong className="text-lg text-slate-900 font-extrabold">Google Sheets</strong>
        </div>
        <span className="text-slate-400">•••</span>
      </div>
      <div className="mb-6">
        <small className="text-sm font-semibold text-slate-500 block mb-1">Balance disponible</small>
        <strong className="text-3xl font-black text-slate-200 block mb-1">—</strong>
        <em className="text-xs font-medium text-slate-400 not-italic">Se calculará con tus primeros movimientos</em>
      </div>
      <div className="bg-slate-50 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400 gap-3 border border-dashed border-slate-200 mb-6 min-h-[120px]">
        <FileSpreadsheet size={24} />
        <span className="text-sm font-semibold text-slate-500">Aún no hay movimientos registrados</span>
      </div>
      <div className="flex justify-between items-center bg-slate-50 rounded-2xl p-4">
        <div className="flex flex-col">
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1">
            <i className="w-2 h-2 rounded-full bg-emerald-400" /> Ingresos
          </span>
          <b className="text-slate-300">—</b>
        </div>
        <div className="flex flex-col text-right">
          <span className="flex items-center gap-1.5 justify-end text-xs font-bold text-slate-500 mb-1">
            <i className="w-2 h-2 rounded-full bg-rose-400" /> Gastos
          </span>
          <b className="text-slate-300">—</b>
        </div>
      </div>
    </div>
  );
}

interface AuthScreenProps {
  onSuccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      const connection = await getConnection();
      if (connection.status === 'connected' || connection.status === 'authorized' || connection.status === 'provisioning') {
        onSuccess?.();
        navigate('/app');
        return;
      }
      const { authorizationUrl } = await startGoogleAuthorization();
      window.location.assign(authorizationUrl);
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Error desconocido';
      const errorCode = (caught as any).code || '';
      console.error(errorMessage, errorCode);
      if (errorCode === 'auth/unauthorized-domain' || errorMessage.includes('unauthorized-domain')) {
        setError('El dominio actual no está autorizado. Para poder iniciar sesión en la vista previa, abre la aplicación en una nueva pestaña haciendo clic en el icono superior derecho, o añade este dominio en la consola de Firebase.');
      } else if (errorCode === 'auth/popup-closed-by-user') {
        setError('Cerraste la ventana de inicio de sesión antes de terminar. Inténtalo de nuevo.');
      } else if (errorMessage.includes('Cross-Origin-Opener-Policy') || errorMessage.includes('popup-blocked')) {
        setError('El navegador bloqueó la ventana emergente. Por favor, abre la aplicación en una nueva pestaña usando el botón en la esquina superior derecha.');
      } else {
        setError('No pudimos iniciar sesión. Si el problema persiste, intenta abrir la app en una nueva pestaña (botón superior derecho). Detalle: ' + errorCode);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      <div className="w-full md:w-1/2 p-6 md:p-12 lg:p-20 flex flex-col justify-center max-w-2xl mx-auto md:mx-0">
        <section className="mb-12">
          <button className="mb-12 hover:opacity-80 transition-opacity" onClick={() => navigate('/')} aria-label="Volver al inicio">
            <CuantlyBrand />
          </button>
          <div className="mb-10">
            <p className="text-emerald-600 font-bold text-sm tracking-wide uppercase mb-3">Tu espacio financiero</p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
              Ver tu dinero con claridad cambia la conversación.
            </h1>
            <p className="text-slate-600 text-lg font-medium leading-relaxed max-w-md">
              Cuantly reúne tus movimientos, encuentra patrones y convierte el ruido del día a día en decisiones que se sienten posibles.
            </p>
          </div>
          
          <AuthPreview />
          
          <div className="mt-8 flex flex-col gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Check size={12} strokeWidth={3} /></span>
              Una vista limpia de todo tu mes
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Check size={12} strokeWidth={3} /></span>
              Insights que llegan con contexto
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Check size={12} strokeWidth={3} /></span>
              Tus datos bajo tu control
            </span>
          </div>
        </section>
      </div>

      <div className="w-full md:w-1/2 bg-white flex flex-col justify-center p-6 md:p-12 lg:p-20 shadow-2xl z-10 border-l border-slate-100">
        <main className="max-w-md w-full mx-auto">
          <button className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors mb-10" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Volver a Cuantly
          </button>
          
          <div className="mb-8">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md">
              <CuantlyMark size={24} />
            </div>
            <p className="text-emerald-600 font-bold text-xs tracking-wider uppercase mb-2">Acceso seguro</p>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">Bienvenido de nuevo</h2>
            <p className="text-slate-600 font-medium">Inicia sesión para abrir tu espacio financiero privado.</p>
          </div>

          {error && (
            <div role="alert" className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl mb-6 flex gap-3 text-rose-700">
              <ShieldCheck size={20} className="shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <button 
            className="w-full bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800 font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-sm group disabled:opacity-50 disabled:cursor-not-allowed mb-8"
            onClick={handleGoogleLogin} 
            disabled={loading}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.56-5.17 3.56-8.68Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3.02c-1.07.72-2.43 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.12A12 12 0 0 0 12 24Z" />
              <path fill="#FBBC05" d="M5.27 14.27A7.22 7.22 0 0 1 4.9 12c0-.79.14-1.56.37-2.27V6.61H1.26A12 12 0 0 0 0 12c0 1.94.46 3.78 1.26 5.39l4.01-3.12Z" />
              <path fill="#EA4335" d="M12 4.78c1.77 0 3.36.61 4.61 1.81l3.45-3.45C17.95 1.16 15.23 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.12C6.22 6.89 8.87 4.78 12 4.78Z" />
            </svg>
            <span className="text-base">{loading ? 'Conectando…' : 'Continuar con Google'}</span>
            {!loading && <ArrowRight size={18} className="text-slate-400 group-hover:text-slate-800 transition-colors" />}
          </button>

          <div className="bg-slate-50 rounded-2xl p-5 mb-8 flex gap-4">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400 shrink-0 shadow-sm">
              <LockKeyhole size={14} />
            </div>
            <div>
              <strong className="block text-sm font-bold text-slate-800 mb-1">Tu acceso permanece privado</strong>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Firebase protege tu sesión y la conexión con Google Drive. No guardamos tus movimientos fuera de tu espacio.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-slate-100 pt-6 mb-6">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><FileSpreadsheet size={14} /> Tu archivo</span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><ShieldCheck size={14} /> Conexión segura</span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><BarChart3 size={14} /> Insights claros</span>
          </div>

          <p className="text-center text-[11px] font-medium text-slate-400 max-w-xs mx-auto">
            No hay acceso con correo y contraseña ni modo invitado. Al continuar aceptas usar Cuantly de forma responsable.
          </p>
        </main>
      </div>
    </div>
  );
};
`;

fs.writeFileSync('src/components/AuthScreen.tsx', authCode);

const landingCode = `
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Brain, Check, FileSpreadsheet, Menu, ShieldCheck, TrendingUp, X, Zap, LockKeyhole } from 'lucide-react';
import { CuantlyBrand } from './CuantlyBrand';

function LandingDashboardPreview() {
  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden hidden md:block select-none pointer-events-none transform rotate-1 hover:rotate-0 transition-transform duration-500">
      <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold">C</span>
          <strong className="text-slate-900 font-extrabold text-sm tracking-tight">Cuantly</strong>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 shadow-sm">
            Archivo conectado
          </div>
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs">
            TU
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="flex justify-between items-end mb-6">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Periodo actual</span>
            <div className="h-6 w-32 bg-slate-100 rounded-md"></div>
          </div>
          <div className="flex gap-4">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-[120px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">$</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Ingresos</span>
              </div>
              <div className="h-5 w-20 bg-slate-200 rounded-md"></div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-[120px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-bold">$</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Gastos</span>
              </div>
              <div className="h-5 w-20 bg-slate-200 rounded-md"></div>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-6">
          <div className="flex justify-between items-center mb-4">
            <strong className="text-sm font-extrabold text-slate-800">Balance del mes</strong>
            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">Vista previa</span>
          </div>
          <div className="h-24 flex items-end gap-2 pt-4">
            <div className="w-full bg-slate-200 rounded-t-sm h-1/3"></div>
            <div className="w-full bg-slate-200 rounded-t-sm h-1/2"></div>
            <div className="w-full bg-emerald-300 rounded-t-sm h-2/3"></div>
            <div className="w-full bg-emerald-400 rounded-t-sm h-full"></div>
            <div className="w-full bg-emerald-500 rounded-t-sm h-4/5"></div>
            <div className="w-full bg-slate-200 rounded-t-sm h-1/2"></div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet size={14} className="text-emerald-500" />
              <strong className="text-xs font-bold text-slate-700">Sincronización</strong>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Tus datos se mantienen en un archivo privado bajo tu control.</p>
          </div>
          <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={14} className="text-indigo-500" />
              <strong className="text-xs font-bold text-slate-700">Contexto IA</strong>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Recibe recomendaciones basadas en tus propios hábitos.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const goTo = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-emerald-200">
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <button className="hover:opacity-80 transition-opacity" onClick={() => goTo('/')} aria-label="Ir al inicio">
            <CuantlyBrand />
          </button>
          
          <nav className="hidden md:flex items-center gap-8" aria-label="Navegación principal">
            <button className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors" onClick={() => scrollTo('producto')}>Producto</button>
            <button className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors" onClick={() => scrollTo('como-funciona')}>Cómo funciona</button>
            <button className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors" onClick={() => scrollTo('seguridad')}>Seguridad</button>
          </nav>
          
          <div className="hidden md:flex items-center gap-4">
            <button className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors px-4 py-2" onClick={() => goTo('/auth')}>Iniciar sesión</button>
            <button className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-5 py-2.5 rounded-full flex items-center gap-2 transition-colors shadow-md shadow-slate-900/20" onClick={() => goTo('/app')}>
              Ver dashboard <ArrowRight size={14} />
            </button>
          </div>
          
          <button className="md:hidden w-10 h-10 flex items-center justify-center text-slate-800 bg-slate-100 rounded-full" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen}>
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 top-20 bg-white z-40 p-6 flex flex-col gap-6 md:hidden">
          <button className="text-lg font-bold text-slate-800 text-left py-2 border-b border-slate-100" onClick={() => scrollTo('producto')}>Producto</button>
          <button className="text-lg font-bold text-slate-800 text-left py-2 border-b border-slate-100" onClick={() => scrollTo('como-funciona')}>Cómo funciona</button>
          <button className="text-lg font-bold text-slate-800 text-left py-2 border-b border-slate-100" onClick={() => scrollTo('seguridad')}>Seguridad</button>
          <div className="flex-1" />
          <button className="flex items-center justify-between text-lg font-bold text-slate-800 py-3" onClick={() => goTo('/auth')}>Iniciar sesión <ArrowRight size={18} className="text-slate-400" /></button>
          <button className="bg-slate-900 text-white text-lg font-bold px-6 py-4 rounded-2xl flex items-center justify-between w-full shadow-lg" onClick={() => goTo('/app')}>
            Ver dashboard <ArrowRight size={18} />
          </button>
        </div>
      )}

      <main className="pt-20">
        <section className="max-w-7xl mx-auto px-6 pt-24 pb-20 md:pt-32 md:pb-32 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-emerald-600 font-bold text-sm tracking-widest uppercase mb-4">Controla. Analiza. Decide.</p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-6">
              Tu dinero, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">más claro.</span>
            </h1>
            <p className="text-lg md:text-xl font-medium text-slate-600 leading-relaxed mb-10 max-w-lg">
              Cuantly convierte tus movimientos diarios en señales simples para que tomes mejores decisiones, ahorres con intención y avances con tranquilidad.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <button className="bg-emerald-500 hover:bg-emerald-600 text-white text-base md:text-lg font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-xl shadow-emerald-500/20 group" onClick={() => goTo('/app')}>
                Explorar mi dashboard <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 text-base md:text-lg font-bold px-8 py-4 rounded-2xl transition-colors" onClick={() => scrollTo('como-funciona')}>
                Conoce cómo funciona
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 text-sm font-bold text-slate-500">
              <span className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Check size={12} strokeWidth={3} /></div> Insights claros</span>
              <span className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Check size={12} strokeWidth={3} /></div> Datos bajo tu control</span>
            </div>
          </div>
          <div className="relative perspective-1000">
            <LandingDashboardPreview />
            <div className="absolute -bottom-10 -left-10 bg-white p-5 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-4 hidden lg:flex transform -rotate-2">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <b className="block text-sm font-extrabold text-slate-900 mb-0.5">Tu archivo, tu control</b>
                <small className="block text-xs font-medium text-slate-500">Datos reales al sincronizar</small>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-24 border-y border-slate-100" id="producto">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-12 items-end mb-16">
              <div>
                <p className="text-emerald-600 font-bold text-xs tracking-widest uppercase mb-3">Todo en un mismo lugar</p>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">La claridad también es una estrategia.</h2>
              </div>
              <p className="text-lg font-medium text-slate-600 leading-relaxed md:max-w-md">
                Sin hojas complicadas ni métricas que no dicen nada. Solo la información que necesitas, justo cuando la necesitas.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <article className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all group">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <BarChart3 size={24} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-3">Ve el panorama</h3>
                <p className="text-slate-600 font-medium leading-relaxed">Ingresos, gastos y balance se entienden de un vistazo, con gráficos que cuentan la historia completa.</p>
              </article>
              <article className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all group">
                <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Brain size={24} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-3">Entiende tus hábitos</h3>
                <p className="text-slate-600 font-medium leading-relaxed">Insights automáticos señalan patrones y oportunidades antes de que se conviertan en problemas.</p>
              </article>
              <article className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all group">
                <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Zap size={24} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-3">Decide a tiempo</h3>
                <p className="text-slate-600 font-medium leading-relaxed">Recibe el contexto correcto para ajustar tus gastos y hacer que cada mes avance contigo.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="py-24" id="como-funciona">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-indigo-600 font-bold text-xs tracking-widest uppercase mb-3">Cómo funciona</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6 max-w-2xl mx-auto">De tus movimientos a una decisión mejor.</h2>
            <p className="text-lg font-medium text-slate-600 leading-relaxed mb-16 max-w-2xl mx-auto">
              Cuantly ordena la información y te ayuda a leerla con calma. El resultado: menos ansiedad, más control y un plan que sí puedes seguir.
            </p>
            
            <div className="grid md:grid-cols-3 gap-8 relative max-w-5xl mx-auto">
              <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-slate-200 z-0"></div>
              
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative z-10 text-left">
                <span className="text-5xl font-black text-slate-100 absolute top-6 right-6 select-none">01</span>
                <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center mb-6">
                  <FileSpreadsheet size={28} />
                </div>
                <b className="block text-xl font-extrabold text-slate-900 mb-2 relative z-10">Conecta</b>
                <small className="block text-base font-medium text-slate-500 relative z-10">Tu información financiera se guarda en un archivo de tu propiedad.</small>
              </div>
              
              <div className="bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-800 relative z-10 text-left transform md:-translate-y-4">
                <span className="text-5xl font-black text-slate-800 absolute top-6 right-6 select-none">02</span>
                <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                  <BarChart3 size={28} />
                </div>
                <b className="block text-xl font-extrabold text-white mb-2 relative z-10">Comprende</b>
                <small className="block text-base font-medium text-slate-400 relative z-10">Gráficas limpias para ver lo importante sin abrumarte.</small>
              </div>
              
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative z-10 text-left">
                <span className="text-5xl font-black text-slate-100 absolute top-6 right-6 select-none">03</span>
                <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center mb-6">
                  <TrendingUp size={28} />
                </div>
                <b className="block text-xl font-extrabold text-slate-900 mb-2 relative z-10">Decide</b>
                <small className="block text-base font-medium text-slate-500 relative z-10">Insights accionables que guían tu siguiente paso financiero.</small>
              </div>
            </div>
            
            <div className="mt-16">
              <button className="text-emerald-600 font-bold text-lg hover:text-emerald-700 transition-colors flex items-center gap-2 mx-auto" onClick={() => goTo('/app')}>
                Ver el dashboard en acción <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </section>

        <section className="bg-slate-900 text-white py-24" id="seguridad">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-8">
                <ShieldCheck size={32} className="text-emerald-400" />
              </div>
              <p className="text-emerald-400 font-bold text-xs tracking-widest uppercase mb-3">Tu información merece respeto</p>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight mb-6">Privacidad que se siente simple.</h2>
              <p className="text-lg font-medium text-slate-400 leading-relaxed mb-10">
                El acceso está protegido y tus datos financieros viven en tu propio espacio. Cuantly te ayuda a interpretarlos sin quitarte el control.
              </p>
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center"><LockKeyhole size={18} className="text-slate-300" /></div>
                  <strong className="text-sm font-bold text-white">Acceso protegido</strong>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center"><Check size={18} className="text-emerald-400" strokeWidth={3} /></div>
                  <strong className="text-sm font-bold text-white">Conexión transparente</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-32 text-center bg-gradient-to-b from-white to-slate-50">
          <div className="max-w-3xl mx-auto px-6">
            <p className="text-emerald-600 font-bold text-xs tracking-widest uppercase mb-4">Empieza con lo que ya tienes</p>
            <h2 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">Haz que tu dinero trabaje con más claridad.</h2>
            <p className="text-xl font-medium text-slate-600 leading-relaxed mb-12">
              Abre tu dashboard y mira cómo se siente tomar decisiones con contexto.
            </p>
            <button className="bg-slate-900 hover:bg-slate-800 text-white text-lg md:text-xl font-bold px-10 py-5 rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-2xl shadow-slate-900/20 mx-auto" onClick={() => goTo('/app')}>
              Abrir Cuantly <ArrowRight size={20} />
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <CuantlyBrand compact />
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span className="text-sm font-semibold text-slate-500">Finanzas personales con más claridad.</span>
          </div>
          <button className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5" onClick={() => goTo('/auth')}>
            Iniciar sesión <ArrowRight size={14} />
          </button>
        </div>
      </footer>
    </div>
  );
};
`;

fs.writeFileSync('src/components/LandingPage.tsx', landingCode);

const onboardingCode = `
import React from 'react';
import { CheckCircle2, FileSpreadsheet, Link2, LoaderCircle, ShieldCheck } from 'lucide-react';
import type { GoogleConnection } from '../types';

interface GoogleStorageOnboardingProps {
  connection?: GoogleConnection;
  busy: boolean;
  error?: string;
  onAuthorize: () => Promise<void>;
  onEnsure: () => Promise<void>;
}

const steps = [
  { key: 'account', label: 'Cuenta', description: 'Sesión de Google protegida por Firebase.', icon: ShieldCheck },
  { key: 'authorization', label: 'Autorización', description: 'Permiso limitado a los archivos que use la aplicación.', icon: Link2 },
  { key: 'file', label: 'Archivo', description: 'Un Google Sheet privado de tu propiedad.', icon: FileSpreadsheet },
] as const;

export const GoogleStorageOnboarding: React.FC<GoogleStorageOnboardingProps> = ({ connection, busy, error, onAuthorize, onEnsure }) => {
  const status = connection?.status ?? 'not_connected';
  const authorized = ['authorized', 'provisioning', 'connected'].includes(status);
  const hasFile = status === 'connected';

  const action = status === 'not_connected' || status === 'reauth_required' || status === 'file_missing'
    ? { label: status === 'reauth_required' ? 'Reconectar Google' : 'Autorizar Google Drive', run: onAuthorize }
    : { label: 'Crear o recuperar mi archivo', run: onEnsure };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <section className="bg-white max-w-xl w-full rounded-3xl shadow-xl border border-slate-100 p-8 md:p-12" aria-labelledby="connection-title">
        <span className="text-emerald-600 font-bold text-xs tracking-widest uppercase mb-3 block">Configuración segura</span>
        <h1 id="connection-title" className="text-3xl font-extrabold text-slate-900 tracking-tight mb-4">Prepara tu espacio financiero</h1>
        <p className="text-slate-600 font-medium leading-relaxed mb-10">Tu información financiera se guardará en un Google Sheet de tu propiedad. Esta aplicación no copia movimientos ni presupuestos a Firestore.</p>
        
        <ol className="flex flex-col gap-6 mb-12">
          {steps.map((step, index) => {
            const done = step.key === 'account' || (step.key === 'authorization' && authorized) || (step.key === 'file' && hasFile);
            const current = !done && ((step.key === 'authorization' && !authorized) || (step.key === 'file' && authorized));
            const Icon = step.icon;

            return (
              <li key={step.key} className={\`flex items-start gap-4 \${done ? 'opacity-100' : current ? 'opacity-100' : 'opacity-40'}\`}>
                <span className={\`w-10 h-10 rounded-full flex items-center justify-center shrink-0 \${done ? 'bg-emerald-100 text-emerald-600' : current ? 'bg-indigo-100 text-indigo-600 shadow-inner' : 'bg-slate-100 text-slate-400'}\`}>
                  {done ? <CheckCircle2 size={20} /> : current && busy ? <LoaderCircle className="animate-spin" size={20} /> : <Icon size={20} />}
                </span>
                <div className="pt-1">
                  <strong className={\`block text-sm font-extrabold mb-1 \${done || current ? 'text-slate-900' : 'text-slate-500'}\`}>{index + 1}. {step.label}</strong>
                  <small className="block text-sm font-medium text-slate-500 leading-snug">{step.description}</small>
                </div>
              </li>
            );
          })}
        </ol>

        {error && (
          <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl mb-8 text-sm font-bold text-rose-700" role="alert">
            {error}
          </div>
        )}

        <button 
          type="button" 
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-2xl transition-colors shadow-lg shadow-slate-900/10 mb-6 flex items-center justify-center" 
          disabled={busy} 
          onClick={() => void action.run()}
        >
          {busy ? <><LoaderCircle className="animate-spin mr-2" size={18} /> Preparando…</> : action.label}
        </button>
        
        <p className="text-center text-xs font-semibold text-slate-400">
          La autorización se usa solo para crear y trabajar con el archivo de esta aplicación.
        </p>
      </section>
    </main>
  );
};
`;

fs.writeFileSync('src/components/GoogleStorageOnboarding.tsx', onboardingCode);
