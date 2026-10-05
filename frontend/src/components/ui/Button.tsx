import React from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-2xl font-display font-extrabold tracking-tight transition-all duration-200 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#eb6a38]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100';

  const variants = {
    primary:
      'border border-[#d95d2c] bg-gradient-to-r from-[#eb6a38] via-[#ed7847] to-[#f09e6c] text-white font-extrabold shadow-sm hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]',
    secondary:
      'border border-brand-border bg-gradient-to-r from-brand-green/[0.09] via-brand-surface/60 to-brand-surface dark:from-[#091f19] dark:via-[#0e271f] dark:to-[#173e33] text-brand-text shadow-sm backdrop-blur-md hover:-translate-y-0.5 hover:border-[#f09e6c]/60 hover:from-brand-green/[0.13] hover:to-brand-surface dark:hover:from-[#0c2a22] dark:hover:to-[#1a473b] dark:border-[#173e33] dark:text-white',
    accent:
      'border border-[#d95d2c] bg-gradient-to-r from-[#eb6a38] to-[#f09e6c] text-white shadow-sm hover:-translate-y-0.5 hover:brightness-105 font-bold',
    danger:
      'border border-status-error-text bg-status-error-text text-white shadow-sm hover:-translate-y-0.5 hover:brightness-90',
    ghost:
      'border border-transparent bg-transparent text-brand-muted hover:border-brand-border hover:bg-brand-surface hover:text-brand-text dark:hover:border-[#173e33]',
  };

  const sizes = {
    sm: 'min-h-9 px-4 py-2 text-xs',
    md: 'min-h-11 px-5 py-2.5 text-sm',
    lg: 'min-h-[52px] px-7 py-3.5 text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      data-button-variant={variant}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <LoadingSpinner size="sm" />
          <span>Processing...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
