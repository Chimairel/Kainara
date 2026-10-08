import { routingPriorityLabel, type ReviewRouting } from './review-routing';

export default function ReviewRoutingLabel({ routing }: { routing?: ReviewRouting }) {
  if (!routing || routing.reason === 'ROUTING_DISABLED') return null;
  return (
    <span className="mt-2 block text-[11px] font-medium text-brand-green">
      {routingPriorityLabel(routing)}
      {routing.stage === 'SPECIALIST' && routing.opensAt && (
        <span className="block font-normal text-brand-muted">
          General access by{' '}
          {new Date(routing.opensAt).toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}{' '}
          PHT
        </span>
      )}
    </span>
  );
}
