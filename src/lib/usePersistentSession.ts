import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, authPersistenceReady } from './firebase';
import { isSessionExpired } from './sessionPolicy';

const LAST_ACTIVE_KEY = 'billqo.session.lastActiveAt.v1';
const ACTIVITY_HEARTBEAT_MS = 60 * 60 * 1000;

function readLastActiveAt(): number | undefined {
  try {
    const raw = window.localStorage.getItem(LAST_ACTIVE_KEY);
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function markSessionActivity(now = Date.now()): void {
  try {
    window.localStorage.setItem(LAST_ACTIVE_KEY, String(now));
  } catch {
    // Firebase still owns the authenticated session if localStorage is unavailable.
  }
}

export function clearSessionActivity(): void {
  try {
    window.localStorage.removeItem(LAST_ACTIVE_KEY);
  } catch {
    // Nothing else to clear when browser storage is unavailable.
  }
}

export interface PersistentSessionState {
  user: User | null;
  ready: boolean;
}

export function usePersistentSession(): PersistentSessionState {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: () => void = () => undefined;
    let expiringSession = false;

    void authPersistenceReady.then(() => {
      if (cancelled) return;

      unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        if (cancelled) return;

        if (!nextUser) {
          expiringSession = false;
          clearSessionActivity();
          setUser(null);
          setReady(true);
          return;
        }

        const lastActiveAt = readLastActiveAt();
        if (isSessionExpired(lastActiveAt)) {
          if (expiringSession) return;
          expiringSession = true;
          clearSessionActivity();
          void signOut(auth)
            .catch(() => undefined)
            .finally(() => {
              if (cancelled) return;
              setUser(null);
              setReady(true);
            });
          return;
        }

        expiringSession = false;
        markSessionActivity();
        setUser(nextUser);
        setReady(true);
      }, () => {
        if (cancelled) return;
        setUser(null);
        setReady(true);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const touch = () => markSessionActivity();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') touch();
    };

    window.addEventListener('focus', touch);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') touch();
    }, ACTIVITY_HEARTBEAT_MS);

    return () => {
      window.removeEventListener('focus', touch);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(heartbeat);
    };
  }, [user]);

  return { user, ready };
}
