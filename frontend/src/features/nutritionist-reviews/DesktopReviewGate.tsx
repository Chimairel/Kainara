'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Monitor } from 'lucide-react';

export default function DesktopReviewGate({ children }: { children: ReactNode }) {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const screen = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
    const update = () => setDesktop(screen.matches);
    update();
    screen.addEventListener('change', update);
    return () => screen.removeEventListener('change', update);
  }, []);
  if (desktop === null)
    return (
      <p className="p-8 text-brand-muted" role="status">
        Opening review workspace…
      </p>
    );
  if (!desktop)
    return (
      <section className="m-6 rounded-2xl border border-brand-border bg-brand-surface p-8 text-brand-text">
        <Monitor className="mb-4 h-8 w-8 text-brand-green" />
        <h1 className="text-xl font-bold">Use a desktop to review meals</h1>
        <p className="mt-3 text-sm text-brand-muted">
          The RND review workspace needs a desktop-size window (at least 1024px), with a mouse and keyboard for
          comparing evidence and making decisions.
        </p>
      </section>
    );
  return children;
}
