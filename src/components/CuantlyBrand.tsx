import React from 'react';

export const BILLQO_MOBILE_LOGO_URL = 'https://i.imgur.com/ZnXojOq.png';
export const BILLQO_DESKTOP_LOGO_URL = 'https://i.imgur.com/iUXvcaN.png';

export function CuantlyMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      className={`cuantly-mark ${className}`.trim()}
      src={BILLQO_MOBILE_LOGO_URL}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain' }}
      alt=""
      aria-hidden="true"
      decoding="async"
      draggable={false}
    />
  );
}

export function CuantlyBrand({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <picture className={`cuantly-brand billqo-responsive-brand ${compact ? 'is-compact' : ''} ${className}`.trim()}>
      <source media="(max-width: 767px)" srcSet={BILLQO_MOBILE_LOGO_URL} />
      <img
        src={BILLQO_DESKTOP_LOGO_URL}
        alt="Billqo"
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}
