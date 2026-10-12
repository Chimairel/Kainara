import type { ReactNode } from 'react';

export function ProfileSectionHeader({
  title,
  description,
  level = 2,
}: {
  title: string;
  description: string;
  level?: 2 | 3;
}) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <header>
      <Heading className="font-display text-xl font-bold leading-tight text-brand-text">{title}</Heading>
      {description && <p className="mt-2 max-w-prose text-sm leading-relaxed text-brand-muted">{description}</p>}
    </header>
  );
}

export function ProfileSettingsSurface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`divide-y divide-brand-border rounded-2xl border border-brand-border bg-brand-surface text-left ${className}`}
    >
      {children}
    </div>
  );
}

export default function ProfileSettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-5 px-5 py-7 sm:px-7 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
      <ProfileSectionHeader title={title} description={description} />
      <div className="min-w-0">{children}</div>
    </section>
  );
}
