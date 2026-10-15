import WorkspaceTabs from '@/components/ui/WorkspaceTabs';
import NotificationActivityDot from '@/components/shared/NotificationActivityDot';

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
  const activityLabel = (label: string, count: number, name: string) => (
    <span className="relative inline-flex px-1">
      {label}
      {count > 0 && <>
        <NotificationActivityDot />
        <span className="sr-only">
          {count} {count === 1 ? name.slice(0, -1) : name} waiting
        </span>
      </>}
    </span>
  );
  return (
    <WorkspaceTabs
      value={value}
      onChange={onChange}
      label="Case approval filters"
      level="secondary"
      items={[
        { value: 'pending', label: activityLabel('Pending', pending, 'cases') },
        { value: 'outside', label: activityLabel('Outside food logs', outside, 'feedback requests') },
      ]}
    />
  );
}
