import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { AuthScreen } from './components/AuthScreen';
import { LandingPage } from './components/LandingPage';
import { MobileQaPage } from './components/MobileQaPage';
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
    <HashRouter>
      <Routes>
        <Route path="/qa-mobile" element={<MobileQaPage />} />
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
  );
}
