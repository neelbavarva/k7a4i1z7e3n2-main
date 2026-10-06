'use client';
import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';

/** Full-screen sheet for an expanded chart; opens and closes with the FX picker motion. */
export function Dialog({
  open,
  onOpenChange,
  title,
  subtitle,
  actions,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => event.key === 'Escape' && onOpenChange(false);
    window.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === 'undefined') return null;

  // Portalled to <body>: an animated ancestor would otherwise trap position: fixed.
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={e => e.target === e.currentTarget && onOpenChange(false)}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet-head">
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p className="small muted" style={{ marginTop: 2 }}>{subtitle}</p>}
          </div>
          {/* the sheet's own actions sit on the right, just before Close */}
          <div className="sheet-actions">
            {actions}
            <button type="button" className="btn btn-sm" onClick={() => onOpenChange(false)} aria-label="Close expanded chart">
              <CloseIcon />
              Close
              <kbd className="kbd-hint">Esc</kbd>
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
