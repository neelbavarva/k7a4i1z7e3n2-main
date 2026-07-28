import * as React from 'react';
import { cn } from '@/lib/utils';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'xs' | 'icon';
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        // Base
        'inline-flex items-center justify-center rounded-md font-medium transition-all duration-150 select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/80 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900',
        'disabled:pointer-events-none disabled:opacity-40',
        'active:scale-[0.98]',
        // Variants
        variant === 'default' &&
          'bg-indigo-600 text-white hover:bg-indigo-500 shadow-2xs dark:bg-indigo-500 dark:hover:bg-indigo-400',
        variant === 'outline' &&
          'border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#151927] text-slate-700 dark:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-[#1c2235] hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs',
        variant === 'ghost' &&
          'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100',
        // Sizes
        size === 'default' && 'h-9 px-3.5 text-xs gap-1.5',
        size === 'sm'      && 'h-8 px-2.5 text-[11px] gap-1',
        size === 'xs'      && 'h-6 px-2 text-[10.5px] gap-1',
        size === 'icon'    && 'h-8 w-8 text-xs',
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
