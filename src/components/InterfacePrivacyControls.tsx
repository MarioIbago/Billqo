import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff } from 'lucide-react';

const BALANCE_STORAGE_KEY = 'billqo:balance-hidden';

function isLegalRoute(): boolean {
  const hashPath = window.location.hash.replace(/^#/, '').split('?')[0]?.replace(/\/+$/, '') || '/';
  const publicPath = window.location.pathname.replace(/\/+$/, '') || '/';
  return hashPath === '/privacy' || hashPath === '/terms' || publicPath === '/privacy' || publicPath === '/terms';
}

export function InterfacePrivacyControls() {
  const [balanceHidden, setBalanceHidden] = useState(() => {
    try {
      return window.localStorage.getItem(BALANCE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [balanceLabel, setBalanceLabel] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const updateRouteClass = () => {
      document.documentElement.classList.toggle('billqo-legal-route', isLegalRoute());
    };

    updateRouteClass();
    window.addEventListener('hashchange', updateRouteClass);
    window.addEventListener('popstate', updateRouteClass);
    return () => {
      window.removeEventListener('hashchange', updateRouteClass);
      window.removeEventListener('popstate', updateRouteClass);
      document.documentElement.classList.remove('billqo-legal-route');
    };
  }, []);

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;

    const findBalanceLabel = () => {
      const next = document.querySelector<HTMLElement>('.crystal-balance-header > div:first-child > span:first-child');
      setBalanceLabel((current) => current === next ? current : next);
    };

    findBalanceLabel();
    const observer = new MutationObserver(findBalanceLabel);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('billqo-balance-hidden', balanceHidden);
    try {
      window.localStorage.setItem(BALANCE_STORAGE_KEY, balanceHidden ? '1' : '0');
    } catch {
      // Privacy preference still works for this session when storage is unavailable.
    }

    const amount = balanceLabel?.nextElementSibling;
    if (amount instanceof HTMLElement) {
      if (balanceHidden) amount.setAttribute('aria-hidden', 'true');
      else amount.removeAttribute('aria-hidden');
    }

    return () => {
      if (amount instanceof HTMLElement) amount.removeAttribute('aria-hidden');
    };
  }, [balanceHidden, balanceLabel]);

  if (!balanceLabel) return null;

  return createPortal(
    <button
      type="button"
      className="billqo-balance-visibility"
      aria-pressed={balanceHidden}
      aria-label={balanceHidden ? 'Mostrar balance del periodo' : 'Ocultar balance del periodo'}
      title={balanceHidden ? 'Mostrar balance' : 'Ocultar balance'}
      onClick={() => setBalanceHidden((hidden) => !hidden)}
    >
      {balanceHidden ? <Eye size={15} /> : <EyeOff size={15} />}
    </button>,
    balanceLabel,
  );
}
