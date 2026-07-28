import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 'flat' | 'raised';
}

export function Card({ className, elevation = 'flat', ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        elevation === 'flat'   && 'shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.6)]',
        elevation === 'raised' && 'shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.6)]',
        className,
      )}
      style={{
        borderColor: 'var(--border-base)',
        backgroundColor: 'var(--surface-card)',
        color: 'var(--text-primary)',
      }}
      {...props}
    />
  );
}
