import * as React from 'react';
import { cn } from '@/lib/utils';
import CardDecoration, { type CardDecorationStyle, type CardDecorationVariant } from './CardDecoration';

export type CardVariant = 'default' | 'metric' | 'signal' | 'highlight' | 'subtle';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  interactive?: boolean;
  contentClassName?: string;
  decoration?: CardDecorationStyle;
  decorationSeed?: string;
  decorationVariant?: CardDecorationVariant;
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  default: 'rounded-[28px] border border-brand-border bg-brand-surface text-brand-text shadow-card sm:rounded-[36px]',
  metric:
    'rounded-2xl sm:rounded-3xl border border-brand-border/80 bg-brand-surface text-brand-text shadow-xs hover:border-brand-border hover:shadow-card transition-all duration-200',
  signal:
    'rounded-2xl sm:rounded-3xl border border-brand-border/70 bg-brand-surface text-brand-text shadow-xs transition-all duration-150',
  highlight:
    'rounded-[28px] sm:rounded-[36px] border border-brand-green/30 bg-brand-surface text-brand-text shadow-card transition-all duration-200',
  subtle: 'rounded-2xl border border-brand-border/50 bg-brand-bgAlt/30 text-brand-text',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className = '',
      header,
      footer,
      interactive = false,
      contentClassName,
      decoration = 'none',
      decorationSeed,
      decorationVariant = 'default',
      variant = 'default',
      children,
      ...props
    },
    ref
  ) => {
    const instanceId = React.useId();
    const hasCompoundChildren = React.Children.toArray(children).some(
      (child) =>
        React.isValidElement(child) && [CardHeader, CardContent, CardFooter].includes(child.type as typeof CardHeader)
    );
    const hasLegacySlots = Boolean(header || footer) || !hasCompoundChildren;
    const hasOuterPadding = /(?:^|\s)(?:p|px|py|pt|pr|pb|pl)-/.test(className);
    const resolvedContentClassName = contentClassName ?? (hasOuterPadding ? '' : 'px-6 py-5');

    return (
      <div
        ref={ref}
        className={cn(
          'relative isolate overflow-hidden transition-colors duration-150',
          variantClasses[variant] ?? variantClasses.default,
          interactive && 'cursor-pointer hover:border-brand-green/40 hover:shadow-md',
          className
        )}
        {...props}
      >
        <CardDecoration variant={decorationVariant} style={decoration} seed={decorationSeed ?? instanceId} />
        {hasLegacySlots ? (
          <>
            {header && <div className="relative z-10 border-b border-brand-border/45 px-6 pb-4 pt-5">{header}</div>}
            <div className={cn('relative z-10', resolvedContentClassName)}>{children}</div>
            {footer && <div className="relative z-10 border-t border-brand-border/45 px-6 pb-5 pt-4">{footer}</div>}
          </>
        ) : (
          children
        )}
      </div>
    );
  }
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('relative z-10 flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn('text-sm text-brand-muted', className)} {...props} />
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('relative z-10 p-6 pt-0', className)} {...props} />
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('relative z-10 flex items-center p-6 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export default Card;
