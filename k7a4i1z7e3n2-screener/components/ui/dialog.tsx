'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export function Dialog({ open, onOpenChange, title, actions, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => { const key = (event: KeyboardEvent) => event.key === 'Escape' && onOpenChange(false); if (open) window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [open, onOpenChange]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 bg-white" role="dialog" aria-modal="true" aria-label={title} onMouseDown={() => onOpenChange(false)}><div className={cn('dialog-enter flex h-dvh w-screen flex-col bg-white')} onMouseDown={event => event.stopPropagation()}><div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4"><div className="flex min-w-0 items-center gap-[10px]"><h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>{actions}</div><Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close chart"><X size={16}/></Button></div><div className="min-h-0 flex-1 p-2 sm:p-3">{children}</div></div></div>;
}
