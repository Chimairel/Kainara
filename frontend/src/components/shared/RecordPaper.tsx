import type { ComponentPropsWithoutRef } from 'react';

/** Shared document surface for nutrition guidance and immutable staff review records. */
export const recordSectionClass =
  'rounded-2xl sm:rounded-3xl border border-[#dce4e0] dark:border-[#173e33] bg-white/80 dark:bg-[#0c241d]/80 p-3 sm:p-4 shadow-xs space-y-3';
export const recordFieldClass =
  'rounded-2xl border border-[#dce4e0]/80 dark:border-[#173e33]/80 bg-[#faf8f5]/80 dark:bg-[#071914]/80 p-2.5 sm:p-3';

export default function RecordPaper({ className = '', ...props }: ComponentPropsWithoutRef<'article'>) {
  return (
    <article
      {...props}
      className={`mx-auto w-full min-w-0 max-w-4xl rounded-[24px] sm:rounded-[32px] border border-[#dce4e0] dark:border-[#173e33] bg-white dark:bg-[#0a201a] p-4 sm:p-6 shadow-md sm:shadow-lg space-y-4 leading-normal [overflow-wrap:anywhere] text-[#0d2820] dark:text-white print:border-none print:shadow-none print:p-0 print:bg-white print:text-black transition-colors ${className}`}
    />
  );
}
