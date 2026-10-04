import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Native form variant of the Progress dropdown; retains browser required/form behavior. */
const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function NativeSelect(
  { className, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      {...props}
      className={cn(
        'min-h-11 w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-xs font-semibold text-brand-text outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 disabled:opacity-50',
        className
      )}
    />
  );
});
export default NativeSelect;
