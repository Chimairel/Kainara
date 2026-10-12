export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-display tracking-tight transition-all duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#eb6a38]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100';
const emphasized = 'rounded-2xl font-extrabold';
const raised = 'shadow-[0_2px_3px_rgba(13,40,32,0.08),0_6px_14px_rgba(13,40,32,0.10)]';
const orange = `${emphasized} border border-transparent bg-brand-accent text-[#0d2820] ${raised} hover:-translate-y-0.5 hover:bg-brand-accentSoft active:translate-y-0`;
const variants: Record<ButtonVariant, string> = {
  primary: orange,
  accent: orange,
  secondary:
    `rounded-full border border-transparent bg-white font-bold tracking-normal text-[#0d2820] ${raised} hover:-translate-y-0.5 hover:bg-[#f8faf9] active:translate-y-0`,
  danger: `${emphasized} border border-status-error-text bg-status-error-text text-white shadow-sm hover:-translate-y-0.5 hover:brightness-90`,
  ghost: `${emphasized} border border-transparent bg-transparent text-brand-muted hover:border-brand-border hover:bg-brand-surface hover:text-brand-text dark:hover:border-[#173e33]`,
};
const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-4 py-2 text-xs',
  md: 'min-h-11 px-5 py-2.5 text-sm',
  lg: 'min-h-[52px] px-7 py-3.5 text-base',
};

/** Shared action styling for Button and anchors that retain native navigation. */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  className = '',
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}
