import { useEffect, useRef } from 'react';
import { CloudOff } from 'lucide-react';
import { flushFinancialOfflineQueue } from '../lib/api';
import { flushBillingOfflineQueue } from '../lib/billingApi';
import { auth } from '../lib/firebase';
import { useOnlineStatus } from '../lib/network';
import { getOfflineQueue } from '../lib/offlineStore';

export function OfflineStatus() {
  const online = useOnlineStatus();
  const previousOnline = useRef(online);

  useEffect(() => {
    document.documentElement.dataset.billqoOffline = online ? 'false' : 'true';

    const syncCameraInputs = () => {
      document.querySelectorAll<HTMLInputElement>('input[type="file"][capture]').forEach((input) => {
        input.disabled = !online;
        input.setAttribute('aria-disabled', String(!online));
      });
    };

    syncCameraInputs();
    const observer = new MutationObserver(syncCameraInputs);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [online]);

  useEffect(() => {
    const reconnected = online && !previousOnline.current;
    previousOnline.current = online;
    if (!reconnected) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    void (async () => {
      const [financeQueue, billingQueue] = await Promise.all([
        getOfflineQueue(uid, 'finance'),
        getOfflineQueue(uid, 'billing'),
      ]);
      if (financeQueue.length + billingQueue.length === 0) return;

      // One synchronization attempt per real offline -> online transition.
      // No polling and no retry loop are installed, which keeps API/Auth usage bounded.
      await Promise.allSettled([
        flushFinancialOfflineQueue(),
        flushBillingOfflineQueue(),
      ]);

      // Refresh React state after local temporary IDs are reconciled with server IDs.
      window.location.reload();
    })();
  }, [online]);

  if (online) return null;

  return (
    <div className="billqo-offline-status" role="status" aria-live="polite">
      <CloudOff size={14} aria-hidden="true" />
      <span><strong>Sin conexión.</strong> Billqo sigue disponible; los cambios quedan en este dispositivo.</span>
    </div>
  );
}
