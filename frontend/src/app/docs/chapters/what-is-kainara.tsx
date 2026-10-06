import { BookOpen } from 'lucide-react';

import { type DocsChapter } from './chapter-types';
export const whatIsKainaraChapter: DocsChapter = {
  id: 'what-is-kainara',
  title: 'What KAINARA is',
  shortTitle: 'What KAINARA is',
  group: 'Start here',
  icon: BookOpen,
  tone: 'accent',
  summary:
    'A Filipino-focused meal planning and nutrition tracking app that combines local recipes, food-composition references, calculated targets, and scoped professional review.',
  sections: [
    {
      id: 'what-is-kainara-purpose',
      title: 'Purpose and limits',
      content: (
        <>
          <p>
            KAINARA helps people plan meals and record nutrition in a Filipino food context. It offers educational
            guidance and planning tools, not diagnosis or treatment. Gemini can assist with drafts and estimates, while
            recorded data and review rules decide what can be used.
          </p>
          <p>
            The app starts with the information a person provides: body measurements, goals, food preferences,
            restrictions, and a shopping schedule. It then looks for meals that fit the recorded context and presents
            them in a dated plan. The plan is a way to organize choices and track them; it cannot observe what a person
            buys, cooks, or eats.
          </p>
          <p>
            A recipe source, a food-composition record, an AI estimate, and a nutritionist decision answer different
            questions. For example, a published recipe establishes that the dish exists, while a composition record
            describes a food item and serving. Neither alone shows that a prepared meal is suitable for a particular
            medical condition.
          </p>
        </>
      ),
    },
    {
      id: 'what-is-kainara-roles',
      title: 'Who uses it',
      content: (
        <>
          <p>
            Members set a profile, view plans, log food, and manage their data. Registered Nutritionist-Dietitians
            review clinical profiles, documents, meal cases, and new recipe submissions. Administrators manage accounts,
            nutritionist applications, and source data.
          </p>
          <p>
            Members are responsible for keeping their declarations current and checking the actual ingredients and
            portions they use. Nutritionists make scoped decisions from the evidence available in a review.
            Administrators maintain the platform and verify professional access, but an administrator adding a recipe
            does not make it a nutritionist-approved meal.
          </p>
        </>
      ),
    },
  ],
};
