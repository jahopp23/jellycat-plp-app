import * as React from 'react';
import {cn} from '~/lib/cn';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-black text-white',
  secondary: 'bg-neutral-100 text-neutral-800',
  outline: 'border border-neutral-300 text-neutral-700',
  destructive: 'bg-neutral-800 text-white',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

export function Badge({className, variant = 'default', ...props}: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
