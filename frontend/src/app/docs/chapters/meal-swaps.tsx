import { Repeat2 } from 'lucide-react';

import { type DocsChapter } from './chapter-types';
export const mealSwapsChapter: DocsChapter = {
  id: 'meal-swaps',
  title: 'Meal swaps',
  shortTitle: 'Meal swaps',
  group: 'Use KAINARA',
  icon: Repeat2,
  tone: 'cyan',
  summary: 'Preview a replacement for a scheduled slot and confirm it only when it fits your current context.',
  sections: [
    {
      id: 'meal-swaps-preview',
      title: 'Preview and confirm',
      content: (
        <>
          <p>
            KAINARA checks current profile restrictions and the destination slot, and warns when the calorie difference
            is substantial. A confirmed swap changes that plan slot and refreshes its grocery data; it does not approve
            the replacement for every other member.
          </p>
          <p>
            Open the replacement choices from a scheduled meal and inspect the candidate before confirming. The
            comparison concerns the meal in that particular breakfast, lunch, or dinner position. A recipe that is
            eligible elsewhere may still be a poor fit for the current slot&apos;s target or recorded restrictions.
          </p>
          <p>
            After confirmation, use the updated plan and grocery list rather than an earlier export. The swap affects
            your own saved cycle; it does not change the published base recipe or extend a case approval to a different
            health profile.
          </p>
        </>
      ),
    },
    {
      id: 'meal-swaps-limits',
      title: 'Availability',
      content: (
        <>
          <p>
            Choices may be limited by serving evidence, flags, review state, and your profile. If a meal has been logged
            or shopping has begun, whole-plan replacement may be unavailable; inspect the controls shown for that cycle.
          </p>
          <p>
            A small swap list is often a sign that few recorded servings pass all checks at once. Browsable recipes
            without planning-ready evidence are not automatically offered as replacements. If a base meal or its
            particular case approval has been flagged, the affected option is held back until the review is resolved.
          </p>
        </>
      ),
    },
  ],
};
