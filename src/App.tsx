import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { AuthScreen } from './components/AuthScreen';
import { ColorBends } from './components/ColorBends';
import DotField from './components/DotField';
import { LandingPage } from './components/LandingPage';
import { PrivacyPage } from './components/PrivacyPage';
import { SiteFooter } from './components/SiteFooter';
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
        <DotField
          dotRadius={1.5}
          dotSpacing={14}
          cursorRadius={500}
          cursorForce={0.10}
          bulgeOnly
          bulgeStrength={67}
          glowRadius={180}
          sparkle={false}
          waveAmplitude={2.6}
          gradientFrom="rgba(248, 250, 252, 0.24)"
          gradientTo="rgba(148, 163, 184, 0.16)"
          glowColor="rgba(226, 232, 240, 0.24)"
        />
      </div>
      <HashRouter>
        <Routes>
          <Route path="/" element={user ? <Dashboard /> : <LandingPage />} />
          <Route
            path="/auth"
            element={hasGoogleAuthCallback() || !user ? <AuthScreen /> : <Navigate to="/" replace />}
          />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <SiteFooter />
      </HashRouter>
    </>
  );
}
