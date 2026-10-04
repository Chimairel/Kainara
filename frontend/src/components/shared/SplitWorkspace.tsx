import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Shared queue/history + inspection shell. The caller owns selection and role actions. */
export default function SplitWorkspace({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-[28px] border border-brand-border/70 bg-brand-surface text-left shadow-card md:flex-row sm:rounded-[36px]',
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
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; visible?: boolean }) {
  return (
    <div
      {...props}
      className={cn(
        visible ? 'flex' : 'hidden md:flex',
        'relative z-10 h-full w-full min-w-0 flex-col border-brand-border/70 p-4 md:w-[38%] md:min-w-[280px] md:max-w-[400px] md:border-r sm:p-5',
        className
      )}
    >
      {children}
    </div>
  );
}
