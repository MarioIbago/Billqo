import { useCallback, useRef, type CSSProperties, type ReactNode } from 'react';
import './BorderGlow.css';

export interface BorderGlowProps {
  children?: ReactNode;
  className?: string;
  edgeSensitivity?: number;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
  fillOpacity?: number;
}

function parseHSL(hsl: string) {
  const match = hsl.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 0, s: 0, l: 100 };
  return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) };
}

function glowVariables(glowColor: string, intensity: number): Record<string, string> {
  const { h, s, l } = parseHSL(glowColor);
  return {
    '--glow-color': `hsl(${h}deg ${s}% ${l}% / ${Math.min(100, 100 * intensity)}%)`,
    '--glow-color-50': `hsl(${h}deg ${s}% ${l}% / ${Math.min(60, 50 * intensity)}%)`,
    '--glow-color-25': `hsl(${h}deg ${s}% ${l}% / ${Math.min(35, 25 * intensity)}%)`,
    '--glow-color-10': `hsl(${h}deg ${s}% ${l}% / ${Math.min(20, 10 * intensity)}%)`,
  };
}

export default function BorderGlow({
  children,
  className = '',
  edgeSensitivity = 30,
  glowColor = '0 0 100',
  backgroundColor = 'rgba(255,255,255,.42)',
  borderRadius = 24,
  glowRadius = 34,
  glowIntensity = .72,
  coneSpread = 23,
  animated = true,
  colors = ['#ffffff', '#d4d4d8', '#9ca3af'],
  fillOpacity = .1,
}: BorderGlowProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    card.classList.add('is-pointer-steered');
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const kx = dx === 0 ? Infinity : cx / Math.abs(dx);
    const ky = dy === 0 ? Infinity : cy / Math.abs(dy);
    const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    card.style.setProperty('--edge-proximity', `${Math.max(animated ? .76 : 0, edge) * 100}`);
    card.style.setProperty('--cursor-angle', `${angle}deg`);
  }, [animated]);

  const handlePointerLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.classList.remove('is-pointer-steered');
    card.style.removeProperty('--cursor-angle');
    card.style.setProperty('--edge-proximity', animated ? '100' : '0');
  }, [animated]);

  const style = {
    '--card-bg': backgroundColor,
    '--edge-sensitivity': edgeSensitivity,
    '--border-radius': `${borderRadius}px`,
    '--glow-padding': `${glowRadius}px`,
    '--cone-spread': coneSpread,
    '--fill-opacity': fillOpacity,
    '--gradient-one': `radial-gradient(at 82% 18%, ${colors[0] ?? '#fff'} 0px, transparent 52%)`,
    '--gradient-two': `radial-gradient(at 18% 78%, ${colors[1] ?? colors[0] ?? '#d4d4d8'} 0px, transparent 50%)`,
    '--gradient-three': `radial-gradient(at 74% 82%, ${colors[2] ?? colors[1] ?? '#9ca3af'} 0px, transparent 48%)`,
    '--edge-proximity': animated ? 100 : 0,
    ...glowVariables(glowColor, glowIntensity),
  } as CSSProperties;

  return (
    <div
      ref={cardRef}
      className={`border-glow-card${animated ? ' is-animated' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <span className="edge-light" aria-hidden="true" />
      <div className="border-glow-inner">{children}</div>
    </div>
  );
}
