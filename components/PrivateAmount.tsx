import React from 'react';
export default function PrivateAmount({ hidden, children, label = 'Nominal', className = '' }: {
  hidden?: boolean; children: React.ReactNode; label?: string; className?: string;
}) {
  return <span className={`tabular-nums ${className}`} data-private-amount="true" aria-label={hidden ? `${label}: disembunyikan` : undefined}>{hidden ? '••••' : children}</span>;
}
