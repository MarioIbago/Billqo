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
import './billqo-requested-ui.css';

const APP_BASE_PATH = '/app';

// The local OAuth callback is registered on 127.0.0.1. `localhost` and
// `127.0.0.1` are different browser origins, so using both would make the
// Firebase session disappear when Google redirects back after consent.
const mustUseCanonicalLocalOrigin = import.meta.env.DEV && window.location.hostname === 'localhost';

function canonicalizeClientUrl(): void {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const routeFromPath = normalizedPath === '/' || normalizedPath === APP_BASE_PATH
    ? '/'
    : normalizedPath.startsWith(`${APP_BASE_PATH}/`)
      ? normalizedPath.slice(APP_BASE_PATH.length) || '/'
      : normalizedPath;
  const hash = window.location.hash || `#${routeFromPath}`;
  const target = `${APP_BASE_PATH}/${window.location.search}${hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (current !== target) {
    window.history.replaceState({}, document.title, target);
  }
}

if (mustUseCanonicalLocalOrigin) {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.hostname = '127.0.0.1';
  window.location.replace(canonicalUrl.toString());
} else {
  // All client pages share one physical /app/ entry point. HashRouter owns the
  // route after that point, so old clean aliases keep working without reloads:
  // /privacy -> /app/#/privacy, /terms -> /app/#/terms, /auth -> /app/#/auth.
  canonicalizeClientUrl();
  installClientGuards();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <InterfacePrivacyControls />
      <Analytics />
    </StrictMode>,
  );
}
