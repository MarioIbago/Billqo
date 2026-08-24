import { onAuthStateChanged } from 'firebase/auth';
import { flushFinancialOfflineQueue } from './api';
import { flushBillingOfflineQueue } from './billingApi';
import { auth } from './firebase';
import { browserIsOnline } from './network';

let installed = false;
let running: Promise<void> | undefined;

async function flushAll(): Promise<void> {
  if (!browserIsOnline() || !auth.currentUser) return;
  if (running) return running;
  running = Promise.allSettled([
    flushFinancialOfflineQueue(),
    flushBillingOfflineQueue(),
  ]).then(() => undefined).finally(() => {
    running = undefined;
  });
  return running;
}

export function installOfflineSync(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('online', () => {
    void flushAll();
  });

  onAuthStateChanged(auth, (user) => {
    if (user && browserIsOnline()) void flushAll();
  });
}
