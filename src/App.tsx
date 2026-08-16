import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { AuthScreen } from './components/AuthScreen';
import { ColorBends } from './components/ColorBends';
import DotField from './components/DotField';
import { LandingPage } from './components/LandingPage';
import { PrivacyPage } from './components/PrivacyPage';
import { TermsPage } from './components/TermsPage';
import { usePersistentSession } from './lib/usePersistentSession';

function hasGoogleAuthCallback(): boolean {
  const status = new URLSearchParams(window.location.search).get('auth');
  return status === 'google' || status === 'error';
}

function BillqoBackdrop() {
  return (
    <div className="billqo-backdrop" aria-hidden="true">
      <ColorBends
        color="#FFFFFF"
        colorSecondary="#9CA3AF"
        speed={0.2}
        frequency={1}
        noise={0.15}
        bandWidth={0.14}
        rotation={90}
        fadeTop={0.75}
        iterations={1}
        intensity={1.3}
        className="billqo-backdrop-bends"
      />
      <DotField
        className="billqo-backdrop-dots"
        dotRadius={1.5}
        dotSpacing={14}
        cursorRadius={500}
        cursorForce={0.10}
        bulgeOnly
        bulgeStrength={67}
        glowRadius={160}
        sparkle={false}
        waveAmplitude={0}
        gradientFrom="rgba(31, 41, 55, 0.18)"
        gradientTo="rgba(148, 163, 184, 0.13)"
        glowColor="rgba(75, 85, 99, 0.14)"
      />
    </div>
  );
}

export default function App() {
  const { user, ready } = usePersistentSession();

  if (!ready) {
    return (
      <>
        <BillqoBackdrop />
        <main className="crystal-status-screen"><p>Comprobando tu sesión...</p></main>
      </>
    );
  }

  return (
    <>
      <BillqoBackdrop />
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
