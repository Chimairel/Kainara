'use client';
import Link from 'next/link';
import type { ComponentProps } from 'react';

/** Keep genuine links for new tabs; same-page section scrolling leaves the URL clean. */
export default function SectionLink({ href, onClick, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          event.shiftKey
        )
          return;
        const destination = new URL(String(href), window.location.href);
        if (destination.pathname !== window.location.pathname || !destination.hash) return;
        const target = document.getElementById(destination.hash.slice(1));
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start',
        });
      }}
    />
  );
}
