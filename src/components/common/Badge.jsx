import React from 'react';

export const Badge = ({
  children,
  variant = 'neutral', // success | warning | danger | info | primary | neutral
  className = '',
}) => {
  // Auto-map common status strings if variant not explicitly customized
  let resolvedVariant = variant;
  if (typeof children === 'string') {
    const lower = children.toLowerCase();
    if (['active', 'approved', 'passed', 'completed', 'matched', 'present', 'hired'].includes(lower)) {
      resolvedVariant = 'success';
    } else if (['pending', 'in_progress', 'scheduled', 'applied', 'review'].includes(lower)) {
      resolvedVariant = 'warning';
    } else if (['inactive', 'rejected', 'failed', 'not_matched', 'absent', 'cancelled', 'overdue'].includes(lower)) {
      resolvedVariant = 'danger';
    } else if (['open', 'office', 'site', 'field', 'shortlisted'].includes(lower)) {
      resolvedVariant = 'info';
    }
  }

  return (
    <span className={`badge badge-${resolvedVariant} ${className}`.trim()}>
      {children}
    </span>
  );
};

export default Badge;
