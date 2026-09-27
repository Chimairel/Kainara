export type ReviewWorkspace = 'meal' | 'case' | 'profile';

export default function WorkspaceTabs({ value, onChange }: {
  value: ReviewWorkspace;
  onChange: (value: ReviewWorkspace) => void;
}) {
  return <nav aria-label="Nutritionist review queues" className="flex gap-2 border-b border-brand-border px-4 py-3">
    {([['meal', 'Meal verification'], ['case', 'Case approval'], ['profile', 'Profile queue']] as const).map(([key, label]) =>
      <button key={key} type="button" aria-current={value === key ? 'page' : undefined} onClick={() => onChange(key)} className={`rounded-xl px-4 py-2 text-sm font-bold ${value === key ? 'bg-brand-accent text-[#07100d]' : 'text-brand-muted hover:text-brand-text'}`}>{label}</button>
    )}
  </nav>;
}
