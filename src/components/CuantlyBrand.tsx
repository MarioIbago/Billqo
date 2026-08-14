import React from 'react';

export function CuantlyMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`cuantly-mark ${className}`.trim()} width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M8 9.5 16 5l8 4.5v9L16 23l-8-4.5v-9Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8 9.5 8 4.5 8-4.5M16 14v9M16 5v4.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8" cy="9.5" r="2.5" fill="currentColor" /><circle cx="16" cy="5" r="2.5" fill="currentColor" />
      <circle cx="24" cy="9.5" r="2.5" fill="currentColor" /><circle cx="24" cy="18.5" r="2.5" fill="currentColor" />
      <circle cx="16" cy="23" r="2.5" fill="currentColor" /><circle cx="8" cy="18.5" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function CuantlyBrand({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <div className={`cuantly-brand ${compact ? 'is-compact' : ''} ${className}`.trim()}>
      <CuantlyMark size={compact ? 24 : 29} />
      <span>
        <strong>Billqo</strong>
        {!compact && <small>Controla. Analiza. Decide.</small>}
      </span>
    </div>
  );
}
