import React from 'react';
import { Loader2 } from 'lucide-react';

export const Loader = ({ message = 'Loading data...', fullPage = false, size = 'md' }) => {
  const isLg = size === 'lg';
  const ringSize = isLg ? 24 : 16;

  const content = (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: isLg ? 24 : 16, color: 'var(--text-muted)' }}>
      <span
        className="spinner-ring"
        style={{
          width: ringSize,
          height: ringSize,
          borderWidth: isLg ? 2.5 : 2,
        }}
      />
      <span style={{ fontSize: isLg ? '0.94rem' : '0.88rem', color: 'var(--text-main)', fontWeight: 500 }}>
        {message}
      </span>
    </div>
  );

  if (fullPage) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', background: 'transparent' }}>
        {content}
      </div>
    );
  }

  return content;
};

export default Loader;
