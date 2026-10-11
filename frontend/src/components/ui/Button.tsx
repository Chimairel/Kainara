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
    'inline-flex items-center justify-center gap-2 rounded-2xl font-display font-extrabold tracking-tight transition-all duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#eb6a38]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100';

  const variants = {
    primary:
      'border border-transparent bg-brand-accent text-[#0d2820] font-extrabold shadow-[0_2px_3px_rgba(13,40,32,0.08),0_6px_14px_rgba(13,40,32,0.10)] hover:-translate-y-0.5 hover:bg-brand-accentSoft active:translate-y-0',
    secondary:
      'border border-brand-border bg-brand-surface text-brand-text shadow-sm hover:-translate-y-0.5 hover:bg-brand-bgAlt hover:border-brand-accentSoft/60',
    accent:
      'border border-transparent bg-brand-accent text-[#0d2820] shadow-[0_2px_3px_rgba(13,40,32,0.08),0_6px_14px_rgba(13,40,32,0.10)] hover:-translate-y-0.5 hover:bg-brand-accentSoft font-bold',
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
