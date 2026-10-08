import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { DocsChapter } from './DocsChapters';

export const membershipChapter: DocsChapter = {
  id: 'membership',
  title: 'Free access and membership',
  shortTitle: 'Membership',
  group: 'Use KAINARA',
  icon: Sparkles,
  tone: 'green',
  summary: 'How trial timing, continued free planning and membership allowances work.',
  sections: [
    {
      id: 'membership-trial',
      title: 'Your 30-day trial',
      content: (
        <>
          <p>
            The trial begins when your first cleared current plan becomes available. A starter plan is included in these
            30 days; moving to a full weekly plan does not restart the trial. Waiting for profile or meal review and a
            future plan do not start the clock.
          </p>
          <p>
            Check{' '}
            <Link href="/membership" className="font-semibold text-brand-green underline">
              Membership
            </Link>{' '}
            for your actual dates, access and remaining allowances. When test checkout is enabled, payment is handled on
            PayMongo&apos;s hosted test page. Review your plan, dates, credit and amount before continuing. Test
            payments do not charge real money, and memberships do not renew automatically.
          </p>
        </>
      ),
    },
    {
      id: 'membership-transitions',
      title: 'Changing or renewing your plan',
      content: (
        <>
          <p>
            A purchase during your Health trial starts after the trial ends. Renewals and a switch from Health to
            Lifestyle start after your current paid period. An upgrade from Lifestyle to Health starts after payment
            verification and credits the unused Lifestyle period; excess credit stays available for a later purchase.
          </p>
          <p>
            Membership shows your current access and any paid next plan. Finish or close an unfinished checkout before
            starting another. Changing plans does not restart the trial or reset your used allowances.
          </p>
        </>
      ),
    },
    {
      id: 'membership-free',
      title: 'What continues after the trial',
      content: (
        <>
          <p>
            Accounts without needs requiring individual review can continue receiving general weekly meal plans using
            their active nutrition report. Groceries, meal completion, manual outside-food logging, saved records and
            profile corrections remain available. Free access includes a smaller meal-swap and AI estimate allowance.
          </p>
          <p>
            Saving profile corrections is free. Weight-only updates can be applied to general planning for Free.
            Applying activity, goal, preference, supported allergy or shopping changes to planning requires Lifestyle or
            Health after the trial. Progress insights also require Lifestyle or Health. Conditions and unsupported or
            unclear restrictions require Health for updated case context and new case plans after the trial. Existing
            eligible active cycles can finish; previously submitted review and clarification work remains available. New
            safety declarations still invalidate conflicting meals immediately.
          </p>
        </>
      ),
    },
    {
      id: 'membership-reports',
      title: 'Reports and weekly check-ins',
      content: (
        <>
          <p>
            Your first planning report is free. Each weekly “Still the same” check-in creates a new dated report; using
            it for planning is free when its inputs match your previous planning report. It does not restart the trial
            or reset allowances.
          </p>
          <p>
            When you save changes, review the new report and choose “Use this report for meal planning.” If membership
            is required, the app explains Lifestyle or Health access. You can keep a previous eligible planning report
            for ordinary changes; saved health restrictions cannot be hidden by that choice. Correcting mistaken entries
            is free.
          </p>
          <p>
            Persistent reminders show overdue check-ins and unapplied updates. The active report supplies planning
            context to the system and RNDs; a report does not itself certify a meal or replace professional review.
          </p>
        </>
      ),
    },
    {
      id: 'membership-allowances',
      title: 'Allowances and review scope',
      content: (
        <>
          <p>
            Lifestyle costs ₱249/month or ₱2,390/year. Health costs ₱999/month or ₱9,590/year. Lifestyle supports
            shellfish, peanuts and tree nuts, dairy, gluten and eggs through complete reviewed ingredient and allergen
            evidence. Ingredient exclusion checks apply on every tier; missing evidence is never treated as safe.
            Lifestyle and Health have bounded allowances. The initial free allowances are 3 swaps per plan cycle and 2
            AI estimate requests per week. Lifestyle includes 10 swaps per plan cycle and 10 AI estimate requests per
            week. Health includes 21 swaps per cycle, plus 1 plan-review episode per target week and 1 requested
            outside-meal review episode per week. The trial includes Health benefits. The Membership screen shows the
            current configured limits.
          </p>
          <p>
            Estimate and requested outside-review weeks reset Monday at midnight in Manila. Swaps follow each plan
            cycle; plan-review episodes follow the target plan week. One outside-review episode covers the items in one
            logged meal. Failed operations and retries do not spend additional credits. Safety checks and follow-up
            needed to finish an already admitted review do not spend another review allowance. Change individual meals
            through swaps; whole-plan replacement is not a member action.
          </p>
          <p>
            Professional review is scoped to the recorded meal, serving and current health context. It can approve,
            request correction or decline. Membership does not guarantee approval, continuous monitoring or a
            consultation. AI estimates remain estimates unless a recorded RND review confirms them.
          </p>
        </>
      ),
    },
  ],
};
