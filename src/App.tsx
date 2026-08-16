import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { AuthScreen } from './components/AuthScreen';
import { ColorBends } from './components/ColorBends';
import DotField from './components/DotField';
import { LandingPage } from './components/LandingPage';
import { MotionPreferencePortal } from './components/MotionPreferencePortal';
import { PrivacyPage } from './components/PrivacyPage';
import { TermsPage } from './components/TermsPage';
import { useAnimationPreference } from './lib/animationPreference';
import { usePersistentSession } from './lib/usePersistentSession';

function hasGoogleAuthCallback(): boolean {
  const status = new URLSearchParams(window.location.search).get('auth');
  return status === 'google' || status === 'error';
}

function BillqoBackdrop({ animationsEnabled }: { animationsEnabled: boolean }) {
  return (
    <div className="billqo-backdrop" aria-hidden="true">
      <ColorBends
        color="#F8FAFC"
        colorSecondary="#64748B"
        speed={0.28}
        frequency={1}
        noise={0.18}
        bandWidth={0.16}
        rotation={90}
        fadeTop={0.72}
        iterations={1}
        intensity={1.45}
        className="billqo-backdrop-bends"
      />
      <DotField
        className="billqo-backdrop-dots"
        dotRadius={1.5}
        dotSpacing={14}
        cursorRadius={animationsEnabled ? 500 : 0}
        cursorForce={animationsEnabled ? 0.10 : 0}
        bulgeOnly
        bulgeStrength={animationsEnabled ? 67 : 0}
        glowRadius={animationsEnabled ? 180 : 0}
        sparkle={false}
        waveAmplitude={animationsEnabled ? 2.6 : 0}
        gradientFrom="rgba(248, 250, 252, 0.24)"
        gradientTo="rgba(148, 163, 184, 0.16)"
        glowColor="rgba(226, 232, 240, 0.24)"
      />
    </div>
  );
}

export default function App() {
  const { user, ready } = usePersistentSession();
  const [animationsEnabled] = useAnimationPreference();

  if (!ready) {
    return (
      <>
        <BillqoBackdrop animationsEnabled={animationsEnabled} />
        <main className="crystal-status-screen"><p>Comprobando tu sesión...</p></main>
      </>
    );
  }

  return (
    <>
      <BillqoBackdrop animationsEnabled={animationsEnabled} />
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
        <MotionPreferencePortal />
      </HashRouter>
    </>
  );
}
