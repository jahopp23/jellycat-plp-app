import * as React from 'react';
import {cn} from '~/lib/cn';

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'secondary';
type ButtonSize = 'default' | 'sm' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500',
  outline:
    'border border-neutral-300 bg-white text-black hover:bg-neutral-50 disabled:text-neutral-400 disabled:border-neutral-200',
  ghost:
    'bg-transparent text-black hover:bg-neutral-100 disabled:text-neutral-400',
  secondary:
    'bg-neutral-100 text-black hover:bg-neutral-200 disabled:text-neutral-400',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-8 rounded-md px-3 text-sm',
  icon: 'h-9 w-9 rounded-full',
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({className, size = 'default', variant = 'default', ...props}, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
