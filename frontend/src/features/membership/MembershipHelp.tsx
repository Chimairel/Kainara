import InfoHint from '@/components/ui/InfoHint';

/** Keep shared policy explanations outside membership cards and profile forms. */
export default function MembershipHelp() {
  return (
    <InfoHint label="Membership help">
      <div className="space-y-3 text-sm leading-relaxed">
        <p>
          Your 30-day Health trial starts with your first usable current meal plan. Pending review does not start it.
        </p>
        <p>Meal swaps apply to a plan cycle. AI estimates and outside reviews reset weekly in Philippine time.</p>
        <p>
          One plan review covers a weekly plan, including its meal decisions and follow-up. It is not a charge per meal.
        </p>
        <p>
          Profile edits are saved on every plan. Applying ordinary planning changes requires Lifestyle; case planning
          requires Health and RND clearance. First and unchanged weekly reports are free.
        </p>
        <p>Dates use Philippine time. Paid periods require manual renewal. There are no automatic charges.</p>
      </div>
    </InfoHint>
  );
}
