import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'billqo.animations.enabled';
const EVENT_NAME = 'billqo:animations';

function safeStorageRead(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function applyDocumentPreference(enabled: boolean): void {
  document.documentElement.dataset.billqoAnimations = enabled ? 'on' : 'off';
}

export function installAnimationPreference(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  applyDocumentPreference(safeStorageRead());
}

export function setAnimationPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // The visual preference still applies for this tab if storage is unavailable.
  }
  applyDocumentPreference(enabled);
  window.dispatchEvent(new CustomEvent<boolean>(EVENT_NAME, { detail: enabled }));
}

export function useAnimationPreference(): readonly [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return safeStorageRead();
  });

  useEffect(() => {
    applyDocumentPreference(enabled);

    const onPreference = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setEnabled(Boolean(customEvent.detail));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = event.newValue === 'true';
      applyDocumentPreference(next);
      setEnabled(next);
    };

    window.addEventListener(EVENT_NAME, onPreference);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onPreference);
      window.removeEventListener('storage', onStorage);
    };
  }, [enabled]);

  const update = useCallback((next: boolean) => {
    setAnimationPreference(next);
  }, []);

  return [enabled, update] as const;
}
