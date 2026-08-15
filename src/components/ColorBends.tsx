import React from 'react';

export interface ColorBendsProps {
  color?: string;
  colorSecondary?: string;
  speed?: number;
  frequency?: number;
  noise?: number;
  bandWidth?: number;
  rotation?: number;
  fadeTop?: number;
  iterations?: number;
  intensity?: number;
  className?: string;
}

export function ColorBends({
  color = '#F4F4F5',
  colorSecondary = '#8E8E93',
  speed = 0.2,
  frequency = 1,
  noise = 0.15,
  bandWidth = 0.14,
  rotation = 90,
  fadeTop = 0.75,
  iterations = 1,
  intensity = 1.3,
  className = '',
}: ColorBendsProps) {
  const duration = Math.max(12, 34 / Math.max(speed, 0.05));
  const style = {
    '--bend-primary': color,
    '--bend-secondary': colorSecondary,
    '--bend-duration': `${duration}s`,
    '--bend-frequency': Math.max(0.35, frequency),
    '--bend-noise': Math.min(0.32, Math.max(0, noise)),
    '--bend-width': Math.min(0.55, Math.max(0.06, bandWidth)),
    '--bend-rotation': `${rotation}deg`,
    '--bend-fade-top': Math.min(0.95, Math.max(0, fadeTop)),
    '--bend-iterations': Math.min(5, Math.max(1, iterations)),
    '--bend-intensity': Math.min(2, Math.max(0.3, intensity)),
  } as React.CSSProperties;

  return (
    <div className={`billqo-color-bends ${className}`.trim()} style={style} aria-hidden="true">
      <i className="billqo-color-bend billqo-color-bend-a" />
      <i className="billqo-color-bend billqo-color-bend-b" />
      <i className="billqo-color-bend billqo-color-bend-c" />
      <span className="billqo-color-bends-noise" />
    </div>
  );
}
