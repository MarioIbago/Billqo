import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Analytics} from '@vercel/analytics/react';
import App from './App.tsx';
import {InterfacePrivacyControls} from './components/InterfacePrivacyControls';
import {installClientGuards} from './lib/clientGuards';
import './index.css';
import './mobile-polish.css';
import './billqo-premium.css';
import './billqo-interactions.css';
import './billqo-interface-fixes.css';

// The local OAuth callback is registered on 127.0.0.1.  `localhost` and
// `127.0.0.1` are different browser origins, so using both would make the
// Firebase session disappear when Google redirects back after consent. Keep a
// single canonical local origin while preserving the current hash route.
const mustUseCanonicalLocalOrigin = import.meta.env.DEV && window.location.hostname === 'localhost';
const publicRoute = window.location.pathname.replace(/\/+$/, '');

if (mustUseCanonicalLocalOrigin) {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.hostname = '127.0.0.1';
  window.location.replace(canonicalUrl.toString());
} else {
  installClientGuards();

  // Google branding fields use clean, public URLs.  The app itself uses a
  // HashRouter, so normalize those public aliases before React mounts.
  if ((publicRoute === '/privacy' || publicRoute === '/terms') && !window.location.hash) {
    window.history.replaceState({}, document.title, `/#${publicRoute}${window.location.search}`);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <InterfacePrivacyControls />
      <Analytics />
    </StrictMode>,
  );
}
