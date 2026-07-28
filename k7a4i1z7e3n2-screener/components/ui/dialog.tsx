'use client';
import { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export function Dialog({
  open,
  onOpenChange,
  title,
  actions,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const key = (event: KeyboardEvent) => event.key === 'Escape' && onOpenChange(false);
    if (open) {
      window.addEventListener('keydown', key);
      // Prevent body scroll while open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = '';
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-white/10 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onMouseDown={() => onOpenChange(false)}
    >
      <div
        className={cn('dialog-enter flex h-dvh w-screen flex-col bg-white')}
        onMouseDown={event => event.stopPropagation()}
      >
        {/* Dialog header */}
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <h2 id={titleId} className="truncate text-sm font-semibold text-slate-900">
              {title}
            </h2>
            {actions}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            aria-label="Close expanded chart"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Chart content */}
        <div id={descId} className="min-h-0 flex-1 p-2 sm:p-3">
          {children}
        </div>
      </div>
    </div>
  );
}
