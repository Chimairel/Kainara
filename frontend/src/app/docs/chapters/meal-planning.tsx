import { Clock } from 'lucide-react';

import { type DocsChapter } from './chapter-types';
export const mealPlanningChapter: DocsChapter = {
  id: 'meal-planning',
  title: 'Plans and shopping cycles',
  shortTitle: 'Plans and shopping cycles',
  group: 'Use KAINARA',
  icon: Clock,
  tone: 'cyan',
  summary:
    'Your shopping day anchors a seven-day cycle. A shorter starter plan can bridge the days before the next cycle.',
  sections: [
    {
      id: 'meal-planning-targets',
      title: 'Targets and dates',
      content: (
        <>
          <p>
            KAINARA estimates a daily energy target from the profile and allocates it across breakfast, lunch, and
            dinner. A slot date is the day the meal is scheduled, not when the recipe was generated. The starter plan
            and following weekly cycle are separate selections.
          </p>
          <p>
            Targets are planning estimates based on the recorded measurements, activity, and goal. They are used to
            compare possible servings for a slot. They are not measurements of a person&apos;s exact energy needs, and
            the actual food prepared can differ from a recorded recipe.
          </p>
          <p>
            Each planned day has its own breakfast, lunch, and dinner positions. If the next regular cycle begins soon
            after signup, the starter window can be only one day long. The following week should be selected as its own
            cycle; it is not intended to be a copy of the starter day.
          </p>
        </>
      ),
    },
    {
      id: 'meal-planning-selection',
      title: 'How meals are selected',
      content: (
        <>
          <p>
            The planner tries recorded eligible servings first, then other eligible published recipes. It checks current
            restrictions, source availability, ingredient and serving data, and the slot&apos;s energy range. A
            restricted member&apos;s saved candidate may still need one RND case decision before it is actionable.
          </p>
          <p>
            A verified base recipe is only a starting point. The planner still needs a usable portion, enough ingredient
            and nutrition information for its checks, and a fit for the requested meal type and target range. A dish
            that appears in the browse catalogue can therefore be absent from a plan without being medically unsafe.
          </p>
          <p>
            For a member with a restricted profile, a new candidate is a proposal until the required review is complete.
            KAINARA can show that a meal is awaiting review, but it should not present a pending case as an approved
            instruction to eat that meal.
          </p>
        </>
      ),
    },
    {
      id: 'meal-planning-gaps',
      title: 'Variety and missing slots',
      content: (
        <>
          <p>
            KAINARA prefers distinct dishes. When the suitable pool is too small, an eligible recipe can recur on
            another day. A slot can remain empty when no candidate passes the requirements or generation is pending. A
            missing slot is not an instruction to skip eating.
          </p>
          <p>
            The available set changes with the member&apos;s energy target, diet, allergies, conditions, recipe data,
            and active reviews. To fill more days, the planner can rotate a recipe that already passed those checks; it
            does not relax a restriction simply to avoid a blank slot. This means repetition may be more visible when
            few recipes fit a particular breakfast or serving range.
          </p>
          <p>
            If a day is incomplete, check the status shown for that plan and any available retry action. The app may
            still be preparing candidates, or the present catalogue may have no eligible option. Use your own food
            judgment and professional advice as needed; the empty slot is a system limitation.
          </p>
        </>
      ),
    },
  ],
};
