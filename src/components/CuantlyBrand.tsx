import React from 'react';

const BILLQO_ASSET_BASE_URL =
  'https://raw.githubusercontent.com/MarioIbago/cuantly-svg-assets/main/billqo-assets';

const BILLQO_WORDMARK_STYLE: React.CSSProperties = {
  fontFamily:
    '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  fontWeight: 400,
  fontStyle: 'normal',
  letterSpacing: '-0.01em',
};

export function CuantlyMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      className={`cuantly-mark ${className}`.trim()}
      src={`${BILLQO_ASSET_BASE_URL}/mark-black-transparent.png`}
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
    <div className={`cuantly-brand ${compact ? 'is-compact' : ''} ${className}`.trim()}>
      <CuantlyMark size={compact ? 24 : 29} />
      <span>
        <strong style={BILLQO_WORDMARK_STYLE}>Billqo</strong>
        {!compact && <small>Controla. Analiza. Decide.</small>}
      </span>
    </div>
  );
}
