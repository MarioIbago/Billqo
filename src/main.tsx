import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Analytics} from '@vercel/analytics/react';
import App from './App.tsx';
import {installClientGuards} from './lib/clientGuards';
import {installAnimationPreference} from './lib/animationPreference';
import './index.css';
import './mobile-polish.css';
import './billqo-premium.css';
import './billqo-interactions.css';
import './billqo-glass.css';
import './billqo-dark-default.css';
import './billqo-black-grid.css';
import './billqo-mobile-fixes.css';

// Apply the visual preference before React paints. Animations intentionally
// default to off until the user enables them in Configuración.
installAnimationPreference();

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
      <Analytics />
    </StrictMode>,
  );
}
