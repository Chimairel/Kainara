import Link from 'next/link';
import { Compass } from 'lucide-react';

import { inlineLink, type DocsChapter } from './chapter-types';
export const gettingStartedChapter: DocsChapter = {
  id: 'getting-started',
  title: 'Getting started',
  shortTitle: 'Getting started',
  group: 'Start here',
  icon: Compass,
  tone: 'accent',
  summary: 'Create an account, enter your planning context, review the notices, then read your nutrition guidance.',
  sections: [
    {
      id: 'getting-started-profile',
      title: 'Build your profile',
      content: (
        <>
          <p>
            Register and verify your email. Enter body measurements, activity, goal, and food preferences. Declare
            conditions, allergies, and food restrictions accurately. Supporting clinical documents are optional to
            upload during onboarding, although some cases need reviewed evidence before planning.
          </p>
          <p>
            The measurements and activity level help calculate an initial energy target. Diet and food preferences
            narrow the recipes the planner can consider. Conditions and allergies are treated differently from ordinary
            preferences because they may require a profile review and can rule out meals that would otherwise fit the
            calorie target.
          </p>
          <p>
            If a condition is unclear, describe it as accurately as you can rather than choosing a more specific
            diagnosis you have not received. You can provide a relevant clinical document during the optional onboarding
            step or later from your profile. Uploading a file does not automatically confirm its contents or unlock
            planning.
          </p>
        </>
      ),
    },
    {
      id: 'getting-started-finish',
      title: 'Finish onboarding',
      content: (
        <>
          <p>
            Choose a grocery shopping day, review your answers, and accept the current notices. Read and acknowledge
            your{' '}
            <Link href="/profile/nutrition-report" className={inlineLink}>
              Nutrition Guidance
            </Link>
            , which explains calculated targets and restrictions without requiring AI to write the report.
          </p>
          <p>
            The shopping day determines where the regular seven-day cycle begins. If you join before that cycle starts,
            KAINARA may prepare a shorter starter window for the intervening days. Review the summary before accepting
            it: a wrong condition, allergy, or measurement can affect which meals the system considers.
          </p>
          <p>
            Nutrition Guidance records how the current target and restrictions were derived. Acknowledging that you have
            read it does not mean an RND has approved the profile or every meal. If you correct your profile later, the
            guidance and planning status may need to be refreshed.
          </p>
        </>
      ),
    },
    {
      id: 'getting-started-review',
      title: 'When an RND reviews your profile',
      content: (
        <>
          <p>
            Restricted profiles wait for an RND to confirm the recorded planning context. The RND can request a document
            or correction. This confirmation is separate from approval of a particular meal. Members with no declared
            condition, allergy, or restriction can use eligible base recipes without a case review.
          </p>
          <p>
            The review asks whether the recorded restrictions are specific and supported enough for meal planning. It
            does not diagnose a condition. Where the policy requires a document or more detail, the profile remains
            pending until that requirement is met and an RND records a decision.
          </p>
          <p>
            After a restricted profile is confirmed, a proposed meal still goes through its own case review. That second
            decision considers the meal, serving, and health context together. A later change to a condition or allergy
            can make an older decision inapplicable even when the dish itself has not changed.
          </p>
        </>
      ),
    },
  ],
};
