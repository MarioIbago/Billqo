import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { AuthScreen } from './components/AuthScreen';
import { LandingPage } from './components/LandingPage';
import { PrivacyPage } from './components/PrivacyPage';
import { TermsPage } from './components/TermsPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthScreen />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/app/*" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
