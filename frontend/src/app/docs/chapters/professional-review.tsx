import { Stethoscope } from 'lucide-react';

import { type DocsChapter } from './chapter-types';
export const professionalReviewChapter: DocsChapter = {
  id: 'professional-review',
  title: 'Nutritionist and admin review',
  shortTitle: 'Professional review',
  group: 'Review and evidence',
  icon: Stethoscope,
  tone: 'green',
  summary:
    'Meal verification, profile review, and case approval answer different questions and keep separate decision records.',
  sections: [
    {
      id: 'professional-review-types',
      title: 'Three review types',
      content: (
        <>
          <p>
            <strong className="text-brand-text">Meal verification</strong> checks a new dish as a base recipe without a
            patient profile. <strong className="text-brand-text">Profile review</strong> checks declared restrictions
            and submitted evidence before restricted planning.{' '}
            <strong className="text-brand-text">Case approval</strong> checks a particular meal and serving against a
            recorded health context. None is a universal safety guarantee.
          </p>
          <p>
            For example, an administrator can submit a new recipe for meal verification. That decision establishes
            whether the dish belongs in the base catalogue. Separately, a member who declares hypertension may need
            their restriction context confirmed. A proposed serving for that member then receives its own case decision.
            Passing one stage does not silently grant the other two.
          </p>
          <p>
            Published Panlasang Pinoy recipes carry a source-based verification label because they are established
            dishes. That label does not claim that every imported ingredient quantity or nutrient value has been checked
            for planning, and it does not create a health-context approval.
          </p>
        </>
      ),
    },
    {
      id: 'professional-review-decisions',
      title: 'Review decisions',
      content: (
        <>
          <p>
            Nutritionists claim review work and record reasons. One nutritionist makes each meal case decision,
            including higher risk cases. Flags, disputes, changed recipes, or changed member profiles can block reuse.
            Administrators verify nutritionist applications and can submit new recipes for meal verification.
          </p>
          <p>
            A case decision is tied to the ingredients, serving, and profile evidence inspected at review time. Another
            member can benefit from a reusable decision only when the relevant context matches its recorded scope and
            the approval is still active. One nutritionist makes the case decision.
          </p>
          <p>
            A nutritionist’s approval remains current until its supporting recipe or profile changes. A flag raises a
            specific concern; a dispute records conflicting decisions that need resolution. These states keep an
            approval out of reuse while the follow-up is incomplete. A flag on the base meal has a wider effect and
            pauses its related variants and approvals.
          </p>
        </>
      ),
    },
  ],
};
