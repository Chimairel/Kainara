'use client';
import type { MouseEvent } from 'react';
export default function ReviewedByControl({
  name,
  scope,
  onClick,
}: {
  name: string;
  scope?: 'RECIPE' | 'MEMBER' | 'RECORDED';
  onClick: () => void;
}) {
  const reviewer = name.replace(/,?\s*RND$/i, '');
  return (
    <button
      type="button"
      className="mt-2 min-h-11 max-w-full rounded-lg px-1 text-left text-xs font-semibold text-brand-green underline underline-offset-2 focus-visible:outline focus-visible:outline-2"
      title={
        scope === 'MEMBER'
          ? 'Member-specific review and recorded RND credentials'
          : scope === 'RECIPE'
            ? 'Recipe review and recorded RND credentials'
            : 'Recorded RND attribution; review scope unavailable'
      }
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onClick();
      }}
    >
      Reviewed by {reviewer}, RND
      <span className="ml-1 text-[10px] font-normal no-underline">
        · {scope === 'MEMBER' ? 'Your meal approval' : scope === 'RECIPE' ? 'Recipe review' : 'Recorded review'}
      </span>
    </button>
  );
}
