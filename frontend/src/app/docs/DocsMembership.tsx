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
      title: 'Your 14-day trial',
      content: (
        <>
          <p>
            The trial begins when your first cleared current plan becomes available. A starter plan is included in these
            14 days; moving to a full weekly plan does not restart the trial. Waiting for profile or meal review and a
            future plan do not start the clock.
          </p>
          <p>
            Check{' '}
            <Link href="/membership" className="font-semibold text-brand-green underline">
              Membership
            </Link>{' '}
            for your actual dates, access and remaining allowances. Purchases are currently unavailable while pricing
            and payment setup are finalized. No payment details are collected and there are no automatic charges.
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
            Accounts without declared conditions or allergies can continue receiving general weekly meal plans using
            their saved planning profile. Groceries, meal completion, manual outside-food logging, saved records and
            health corrections remain available. Free access includes a smaller meal-swap and AI estimate allowance.
          </p>
          <p>
            Optional goal, preference and shopping changes, optional replans and progress insights require membership.
            Declared conditions or allergies require membership for new case plans after the trial. Existing eligible
            active cycles can finish; previously submitted review and clarification work remains available. New safety
            declarations still invalidate conflicting meals immediately.
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
            One membership uses the same allowances for every subscriber. The initial free allowances are 3 swaps per
            plan cycle and 2 AI estimate requests per week. Membership and trial initially include 6 swaps, 10 AI
            estimate requests, 2 optional replans, 1 plan-review episode and 1 requested outside-meal review episode per
            week. The Membership screen shows the current configured limits.
          </p>
          <p>
            Estimate, optional replan and requested outside-review weeks reset Monday at midnight in Manila. Swaps
            follow each plan cycle; plan-review episodes follow the target plan week. One outside-review episode covers
            the items in one logged meal. Failed operations and retries do not spend additional credits. Safety checks
            and follow-up needed to finish an already admitted review do not spend another review allowance. An optional
            case replan needs a new plan-review allowance as well as a replan allowance.
          </p>
          <p>
            Professional review is scoped to the recorded meal, serving and current health context. It can approve,
            request correction or decline. Membership does not guarantee approval, continuous monitoring or a
            consultation. AI estimates remain estimates unless a recorded nutritionist review confirms them.
          </p>
        </>
      ),
    },
  ],
};
