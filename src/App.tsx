import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { AuthScreen } from './components/AuthScreen';
import { ColorBends } from './components/ColorBends';
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
