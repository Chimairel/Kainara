import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SplitBreakpoint = 'md' | 'xl';

/** Shared queue/history + inspection shell. The caller owns selection and role actions. */
export default function SplitWorkspace({
  children,
  className,
  splitAt = 'md',
  ...props
}: HTMLAttributes<HTMLDivElement> & { splitAt?: SplitBreakpoint }) {
  return (
    <div
      {...props}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-[28px] border border-brand-border/70 bg-brand-surface text-left shadow-card sm:rounded-[36px]',
        splitAt === 'xl' ? 'xl:flex-row' : 'md:flex-row',
        className
      )}
    >
      {children}
    </div>
  );
}

export function WorkspaceListPane({
  children,
  visible = true,
  className,
  splitAt = 'md',
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; visible?: boolean; splitAt?: SplitBreakpoint }) {
  return (
    <div
      {...props}
      className={cn(
        visible ? 'flex' : splitAt === 'xl' ? 'hidden xl:flex' : 'hidden md:flex',
        'relative z-10 h-full w-full min-w-0 flex-col border-brand-border/70 p-4 sm:p-5',
        splitAt === 'xl'
          ? 'xl:w-[38%] xl:min-w-[280px] xl:max-w-[400px] xl:border-r'
          : 'md:w-[38%] md:min-w-[280px] md:max-w-[400px] md:border-r',
        className
      )}
    >
      {children}
    </div>
  );
}
