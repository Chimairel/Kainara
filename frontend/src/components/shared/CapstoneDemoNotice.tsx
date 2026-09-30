export default function CapstoneDemoNotice({ mode }: { mode?: string }) {
  if (mode !== 'capstone-demo') return null;
  return (
    <aside
      role="note"
      aria-label="Capstone demo"
      className="fixed bottom-20 right-3 z-50 max-w-64 rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-text shadow-sm md:bottom-4"
    >
      <strong>Capstone demonstration</strong>
      <p>Not clinically approved. Use test data only.</p>
    </aside>
  );
}
