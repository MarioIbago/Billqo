import { useEffect, useRef, type CSSProperties, type MouseEventHandler, type ReactNode } from 'react';
import './SpecularButton.css';

export interface SpecularButtonProps {
  children?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export default function SpecularButton({
  children = 'Get Started',
  size = 'lg',
  radius = 18,
  tint = '#ffffff',
  tintOpacity = 0,
  blur = 0,
  textColor = '#f5f5f5',
  lineColor = '#ffffff',
  baseColor = '#525252',
  intensity = 1,
  shineSize = 10,
  shineFade = 40,
  thickness = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
}: SpecularButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const propsRef = useRef({ speed, followMouse, proximity, autoAnimate, intensity });
  propsRef.current = { speed, followMouse, proximity, autoAnimate, intensity };

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const reduceMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    if (reduceMotion) {
      button.style.setProperty('--sb-angle', '2.4rad');
      button.style.setProperty('--sb-bright', String(Math.min(1, intensity * 0.72)));
      return;
    }

    let pointerAngle: number | null = null;
    let proximityT = 0;
    let angle = 2.4;
    let idleAngle = 2.4;
    let bright = autoAnimate ? 1 : 0;
    let last = performance.now();
    let raf = 0;

    const onPointerMove = (event: PointerEvent) => {
      const rect = button.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
      const distance = Math.hypot(dx, dy);

      if (distance === 0) {
        const nx = (event.clientX - cx) / Math.max(rect.width / 2, 1);
        const ny = (cy - event.clientY) / Math.max(rect.height / 2, 1);
        pointerAngle = Math.atan2(2 / Math.max(rect.height, 1), -2 / Math.max(rect.width, 1)) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(cy - event.clientY, event.clientX - cx);
      }

      const t = Math.max(0, 1 - distance / Math.max(propsRef.current.proximity, 1));
      proximityT = t * t * (3 - 2 * t);
    };

    const update = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const current = propsRef.current;
      idleAngle += current.speed * dt;
      const steer = current.followMouse && pointerAngle !== null && (!current.autoAnimate || proximityT > 0.02);
      const target = steer ? pointerAngle! : idleAngle;
      const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      angle += diff * (1 - Math.exp(-dt * 7));

      const brightTarget = current.autoAnimate ? Math.max(0.65, proximityT) : proximityT;
      bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8));

      button.style.setProperty('--sb-angle', `${angle}rad`);
      button.style.setProperty('--sb-bright', String(Math.min(1.35, bright * current.intensity)));
      raf = requestAnimationFrame(update);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    raf = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [autoAnimate, intensity]);

  const style = {
    '--sb-radius': `${radius}px`,
    '--sb-tint': tint,
    '--sb-tint-opacity': tintOpacity,
    '--sb-blur': `${blur}px`,
    '--sb-text-color': textColor,
    '--sb-line-color': lineColor,
    '--sb-base-color': baseColor,
    '--sb-shine-size': `${shineSize}deg`,
    '--sb-shine-fade': `${shineFade}deg`,
    '--sb-thickness': `${thickness}px`,
    '--sb-bright': autoAnimate ? intensity : 0,
  } as CSSProperties;

  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`specular-button specular-button--${size}${className ? ` ${className}` : ''}`}
      style={style}
    >
      <span className="specular-button__fx" aria-hidden="true" />
      <span className="specular-button__label">{children}</span>
    </button>
  );
}
