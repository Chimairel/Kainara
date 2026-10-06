import { Sparkles } from 'lucide-react';

import { type DocsChapter } from './chapter-types';
export const trackingChapter: DocsChapter = {
  id: 'tracking',
  title: 'Daily tracking',
  shortTitle: 'Daily tracking',
  group: 'Use KAINARA',
  icon: Sparkles,
  tone: 'green',
  aliases: ['daily-tracking'],
  summary: 'Record what you actually ate or skipped and use progress summaries as a record of your entries.',
  sections: [
    {
      id: 'tracking-meals',
      title: 'Meals and daily progress',
      content: (
        <>
          <p>
            On the dashboard, mark a scheduled meal eaten or skipped. A scheduled meal alone is not proof that it was
            eaten. The calorie and macro summaries depend on what has been recorded.
          </p>
          <p>
            Plan cards describe what was proposed for a date. When you mark a meal eaten, the app can include that
            record in progress summaries; when you skip it, the record reflects that choice instead. Logging a different
            food outside the plan is a separate action. The difference matters because a plan, a completed meal, and an
            outside meal are not interchangeable evidence of intake.
          </p>
        </>
      ),
    },
    {
      id: 'tracking-other',
      title: 'Water, weight, and changes',
      content: (
        <>
          <p>
            Record water and weight separately. Weight and adherence summaries are not diagnoses. If you change a
            restriction or another planning input, review the current plan again; a saved meal can need revalidation
            even when its name is unchanged.
          </p>
          <p>
            Progress charts summarize the entries available to the system. A missing entry can mean that nothing was
            recorded, not that no food or water was consumed. Weight changes can have many causes, so use these charts
            as a personal record rather than as a medical interpretation.
          </p>
          <p>
            If you update an allergy, condition, or food restriction, check meals already scheduled for future dates.
            KAINARA may pause or recheck their use because the earlier decision was made for the previous profile.
          </p>
        </>
      ),
    },
  ],
};
