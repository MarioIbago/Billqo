import { useEffect } from 'react';
import { CloudOff } from 'lucide-react';
import { useOnlineStatus } from '../lib/network';

export function OfflineStatus() {
  const online = useOnlineStatus();

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

  if (online) return null;

  return (
    <div className="billqo-offline-status" role="status" aria-live="polite">
      <CloudOff size={14} aria-hidden="true" />
      <span><strong>Sin conexión.</strong> Billqo sigue disponible; los cambios quedan en este dispositivo.</span>
    </div>
  );
}
