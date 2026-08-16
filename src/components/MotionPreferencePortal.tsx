import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { useAnimationPreference } from '../lib/animationPreference';

export function MotionPreferencePortal() {
  const [enabled, setEnabled] = useAnimationPreference();
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    const findTarget = () => {
      const next = document.querySelector('.crystal-settings-grid');
      setTarget((current) => current === next ? current : next);
    };

    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;

  return createPortal(
    <section className="crystal-panel crystal-settings-card billqo-motion-settings" aria-labelledby="billqo-motion-title">
      <div className="billqo-motion-settings-copy">
        <span className="billqo-motion-settings-icon" aria-hidden="true"><Sparkles size={18} /></span>
        <div>
          <h2 id="billqo-motion-title">Animaciones</h2>
          <p>Controla el movimiento ambiental del fondo, puntos, brillos y bordes. Viene desactivado por defecto.</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        className={`billqo-motion-switch${enabled ? ' is-on' : ''}`}
        onClick={() => setEnabled(!enabled)}
      >
        <span aria-hidden="true" />
        <b>{enabled ? 'Activadas' : 'Desactivadas'}</b>
      </button>
    </section>,
    target,
  );
}
