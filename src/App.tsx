import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { AuthScreen } from './components/AuthScreen';
import { ColorBends } from './components/ColorBends';
import Ferrofluid from './components/Ferrofluid';
import { LandingPage } from './components/LandingPage';
import { PrivacyPage } from './components/PrivacyPage';
import { TermsPage } from './components/TermsPage';
import { usePersistentSession } from './lib/usePersistentSession';

function hasGoogleAuthCallback(): boolean {
  const status = new URLSearchParams(window.location.search).get('auth');
  return status === 'google' || status === 'error';
}

export default function App() {
  const { user, ready } = usePersistentSession();

  if (!ready) {
    return <main className="crystal-status-screen"><p>Comprobando tu sesión...</p></main>;
  }

  return (
    <>
      <ColorBends
        color="#F4F4F5"
        colorSecondary="#8E8E93"
        speed={0.2}
        frequency={1}
        noise={0.15}
        bandWidth={0.14}
        rotation={90}
        fadeTop={0.75}
        iterations={1}
        intensity={1.3}
      />
      <div
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      >
        <Ferrofluid
          colors={['#f8fafc', '#a1a1aa', '#52525b']}
          speed={0.22}
          scale={1.35}
          turbulence={0.78}
          fluidity={0.18}
          rimWidth={0.07}
          sharpness={1.75}
          shimmer={0.72}
          glow={1.15}
          opacity={0.72}
          mouseInteraction
          mouseStrength={0.9}
          mouseRadius={0.42}
          mouseDampening={0.16}
          mixBlendMode="screen"
        />
      </div>
      <HashRouter>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/app" replace /> : <LandingPage />} />
          <Route
            path="/auth"
            element={hasGoogleAuthCallback() || !user ? <AuthScreen /> : <Navigate to="/app" replace />}
          />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/app/*" element={user ? <Dashboard /> : <Navigate to="/auth" replace />} />
          <Route path="*" element={<Navigate to={user ? '/app' : '/'} replace />} />
        </Routes>
      </HashRouter>
    </>
  );
}
