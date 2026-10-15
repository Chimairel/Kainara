import WorkspaceTabs from '@/components/ui/WorkspaceTabs';

export default function CaseReviewFilters({
  value,
  onChange,
  pending = 0,
  outside = 0,
}: {
  value: 'pending' | 'outside';
  onChange: (value: 'pending' | 'outside') => void;
  pending?: number;
  outside?: number;
}) {
  const activity = (count: number, name: string) =>
    count > 0 ? (
      <span className="inline-flex items-center">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-text" />
        <span className="sr-only">
          {count} {count === 1 ? name.slice(0, -1) : name} waiting
        </span>
      </span>
    ) : undefined;
  return (
    <WorkspaceTabs
      value={value}
      onChange={onChange}
      label="Case approval filters"
      level="secondary"
      items={[
        { value: 'pending', label: 'Pending', icon: activity(pending, 'cases') },
        { value: 'outside', label: 'Outside food logs', icon: activity(outside, 'feedback requests') },
      ]}
    />
  );
}
