import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  interactive?: boolean;
  contentClassName?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', header, footer, interactive = false, contentClassName, children, ...props }, ref) => {
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
          'overflow-hidden rounded-2xl border border-brand-border bg-brand-surface text-brand-text shadow-sm transition-colors duration-150',
          interactive && 'cursor-pointer hover:border-brand-green/40 hover:shadow-md',
          className
        )}
        {...props}
      >
        {hasLegacySlots ? (
          <>
            {header && <div className="border-b border-brand-border/45 px-6 pb-4 pt-5">{header}</div>}
            <div className={resolvedContentClassName}>{children}</div>
            {footer && <div className="border-t border-brand-border/45 px-6 pb-5 pt-4">{footer}</div>}
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
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
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
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
);
CardFooter.displayName = 'CardFooter';

export default Card;
