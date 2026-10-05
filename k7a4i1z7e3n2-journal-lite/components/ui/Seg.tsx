'use client';

import type { ReactNode } from 'react';

export type SegOption<T extends string> = { value: T; label: ReactNode; count?: number; title?: string; disabled?: boolean; icon?: ReactNode };

/** Segmented control, the same switch the other Kaizen sites use. */
export default function Seg<T extends string>({
  options,
  value,
  onChange,
  label,
  wide,
  className = '',
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className={`seg${wide ? ' seg-wide' : ''} ${className}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          title={o.title}
          disabled={o.disabled}
        >
          {o.icon}
          {o.label}
          {o.count != null && <span className="seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
