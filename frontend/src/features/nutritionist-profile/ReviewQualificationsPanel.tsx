import Card from '@/components/ui/Card';
import { expertiseLabel } from '@/features/nutritionist-reviews/review-routing';

export default function ReviewQualificationsPanel({
  verifiedExpertise = [],
  verifiedExperienceYears,
}: {
  verifiedExpertise?: string[];
  verifiedExperienceYears?: number | null;
}) {
  return (
    <Card className="p-5 space-y-3">
      <h2 className="font-display text-lg font-bold">Review qualifications</h2>
      <p className="text-xs leading-relaxed text-brand-muted">
        Cases appear automatically in the shared queue for every eligible RND. Expertise, experience and online status
        do not affect access. Claim a case when you start reviewing it.
      </p>
      <div className="rounded-xl border border-brand-border p-3 text-sm">
        <p className="font-semibold">Admin-verified expertise</p>
        <p className="mt-1 text-brand-muted">
          {verifiedExpertise.length
            ? verifiedExpertise.map(expertiseLabel).join(' · ')
            : 'No specialist expertise verified yet.'}
        </p>
        {verifiedExperienceYears != null && (
          <p className="mt-1 text-xs text-brand-muted">
            {verifiedExperienceYears} verified year{verifiedExperienceYears === 1 ? '' : 's'} of experience
          </p>
        )}
        <p className="mt-2 text-xs text-brand-muted">
          These credentials are shown for reference and do not give priority in the review queue.
        </p>
      </div>
    </Card>
  );
}
