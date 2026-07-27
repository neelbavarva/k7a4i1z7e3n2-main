import * as React from 'react';
import { cn } from '@/lib/utils';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost'; size?: 'default' | 'icon' | 'sm' };
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'default', size = 'default', ...props }, ref) => <button ref={ref} className={cn('inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50', variant === 'default' && 'bg-slate-900 text-white hover:bg-slate-800', variant === 'outline' && 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50', variant === 'ghost' && 'text-slate-600 hover:bg-slate-100 hover:text-slate-900', size === 'default' && 'h-9 px-3', size === 'sm' && 'h-8 px-2.5 text-xs', size === 'icon' && 'h-8 w-8', className)} {...props} />);
Button.displayName = 'Button';
