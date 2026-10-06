import { UtensilsCrossed } from 'lucide-react';

import { type DocsChapter } from './chapter-types';
export const mealLibraryChapter: DocsChapter = {
  id: 'meal-library',
  title: 'Meal Library',
  shortTitle: 'Meal Library',
  group: 'Use KAINARA',
  icon: UtensilsCrossed,
  tone: 'green',
  summary:
    'The Library distinguishes a verified base recipe from a reusable approval and a serving scheduled in your own plan.',
  sections: [
    {
      id: 'meal-library-labels',
      title: 'What the labels mean',
      content: (
        <>
          <p>
            <strong className="text-brand-text">Verified base recipes</strong> are published Panlasang Pinoy dishes or
            other recipes whose identity was checked. That means the dish is a real recipe; it does not certify
            nutrition or suitability for everyone. <strong className="text-brand-text">Reusable recipes</strong> have
            recorded serving and safety evidence for the relevant query.{' '}
            <strong className="text-brand-text">Meals in your plan</strong> are scheduled portions and may appear before
            separate reusable certification.
          </p>
          <p>
            The labels refer to different records. A base recipe can be browsed because its identity is known, while the
            planner may still lack the portion or ingredient evidence needed to schedule it. A case approval is
            narrower: it applies to a recorded serving and health context and can be reused only when the later
            member&apos;s relevant context matches the approved scope.
          </p>
        </>
      ),
    },
    {
      id: 'meal-library-use',
      title: 'Browsing and use',
      content: (
        <>
          <p>
            Browsing a recipe does not add it to your plan. Planning and swaps check your current profile, source
            availability, serving data, and the selected slot. A goal or calorie mismatch can change eligibility without
            changing the identity of the dish.
          </p>
          <p>
            The browse view is meant for discovery. It can show more verified dishes than the number currently suitable
            for a plan. To understand why a recipe was scheduled, compare its recorded serving and status with the date,
            meal type, and your current profile. If your health information changes, a recipe that appeared earlier may
            need a fresh decision.
          </p>
        </>
      ),
    },
    {
      id: 'meal-library-flags',
      title: 'Flags and approvals',
      content: (
        <>
          <p>
            A flagged base meal is withheld together with its serving variants and associated approvals until reviewed.
            A case approval can also be flagged or become due for recheck without changing the published base recipe.
          </p>
          <p>
            These two levels matter when something is questioned. A meal-level flag pauses the underlying dish and every
            approval built on it. An approval-level flag applies only to the particular serving and health context
            reviewed. A due or disputed approval is also unavailable for reuse until the required follow-up is recorded.
          </p>
        </>
      ),
    },
  ],
};
