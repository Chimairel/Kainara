'use client';
import type { ButtonHTMLAttributes } from 'react';

/** Unscaled task controls alongside the canvas navigation tools. */
export default function CanvasToolButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type="button" aria-haspopup="dialog"
    className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-brand-text hover:bg-brand-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-50" />;
}
