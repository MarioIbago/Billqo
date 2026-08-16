import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  FileSpreadsheet,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { auth, authPersistenceReady } from '../lib/firebase';
import { consumeFirebaseSignInExchange, googleSignInStartUrl } from '../lib/api';
import { CuantlyBrand, CuantlyMark } from './CuantlyBrand';
import SpecularButton from './SpecularButton';

function GoogleLogo() {
  return (
    <svg className="crystal-google-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.56-5.17 3.56-8.68Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3.02c-1.07.72-2.43 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.12A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.27A7.22 7.22 0 0 1 4.9 12c0-.79.14-1.56.37-2.27V6.61H1.26A12 12 0 0 0 0 12c0 1.94.46 3.78 1.26 5.39l4.01-3.12Z" />
      <path fill="#EA4335" d="M12 4.78c1.77 0 3.36.61 4.61 1.81l3.45-3.45C17.95 1.16 15.23 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.12C6.22 6.89 8.87 4.78 12 4.78Z" />
    </svg>
  );
}

function callbackStatus(): 'google' | 'error' | undefined {
  const value = new URLSearchParams(window.location.search).get('auth');
  return value === 'google' || value === 'error' ? value : undefined;
}

function clearCallbackStatus(): void {
  const path = window.location.pathname || '/app/';
  const hash = window.location.hash || '#/auth';
  window.history.replaceState({}, document.title, `${path}${hash}`);
}

export const AuthScreen: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const exchangeStarted = useRef(false);

  useEffect(() => {
    const returned = callbackStatus();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Do not leave the callback before exchanging its one-time token.
      if (currentUser && returned !== 'google') navigate('/', { replace: true });
    });

    void (async () => {
      await authPersistenceReady;
      if (returned === 'error') {
        clearCallbackStatus();
        setError('No pudimos completar el inicio de sesión de Google. Inténtalo de nuevo.');
        return;
      }
      if (returned !== 'google') {
        if (auth.currentUser) navigate('/', { replace: true });
        return;
      }
      if (exchangeStarted.current) return;
      exchangeStarted.current = true;

      setLoading(true);
      try {
        const customToken = await consumeFirebaseSignInExchange();
        if (!customToken) throw new Error('missing_sign_in_exchange');
        await signInWithCustomToken(auth, customToken);
        clearCallbackStatus();
        navigate('/', { replace: true });
      } catch {
        clearCallbackStatus();
        setError('Google confirmó tu cuenta, pero no pudimos abrir la sesión segura. Inténtalo de nuevo.');
      } finally {
        setLoading(false);
      }
    })().catch(() => {
      setError('No pudimos preparar el inicio de sesión. Inténtalo de nuevo.');
    });

    return unsubscribe;
  }, [navigate]);

  const handleGoogleLogin = () => {
    setLoading(true);
    setError(null);
    window.location.assign(googleSignInStartUrl());
  };

  return (
    <div className="crystal-public-page crystal-auth-page">
      <div className="crystal-orb crystal-orb-a" aria-hidden="true" />
      <div className="crystal-orb crystal-orb-b" aria-hidden="true" />

      <main className="crystal-auth-card" aria-labelledby="auth-title">
        <button className="crystal-back-link" onClick={() => navigate('/')} type="button">
          <ArrowLeft size={17} />
          Volver
        </button>

        <div className="crystal-auth-brand"><CuantlyBrand /></div>
        <div className="crystal-auth-mark" aria-hidden="true"><CuantlyMark size={26} /></div>

        <div className="crystal-auth-copy">
          <span className="crystal-eyebrow">Acceso seguro</span>
          <h1 id="auth-title">Bienvenido de nuevo</h1>
          <p>Usa tu cuenta de Google para entrar y autorizar tu espacio financiero.</p>
        </div>

        {error && (
          <div className="crystal-alert crystal-alert-error" role="alert">
            <ShieldCheck size={19} />
            <span>{error}</span>
          </div>
        )}

        <SpecularButton
          size="lg"
          radius={18}
          tint="#17191d"
          tintOpacity={0.94}
          blur={20}
          textColor="#ffffff"
          lineColor="#ffffff"
          baseColor="#6b7280"
          intensity={1}
          speed={0.35}
          followMouse
          autoAnimate
          className="billqo-specular-auth"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? <LoaderCircle className="spin" size={20} /> : <GoogleLogo />}
          <span>{loading ? 'Conectando…' : 'Continuar con Google'}</span>
          {!loading && <ArrowRight size={18} />}
        </SpecularButton>

        <section className="crystal-privacy-note">
          <LockKeyhole size={18} />
          <div>
            <strong>Tus datos siguen bajo tu control</strong>
            <p>Firebase confirma tu identidad. Tus movimientos permanecen en tu Google Sheet privado.</p>
          </div>
        </section>

        <button type="button" className="crystal-auth-privacy-link" onClick={() => navigate('/privacy')}>
          Leer privacidad y control de datos
        </button>

        <div className="crystal-auth-meta">
          <span><FileSpreadsheet size={15} /> Google Sheets</span>
          <span><ShieldCheck size={15} /> Solo acceso con Google</span>
        </div>
      </main>
    </div>
  );
};
