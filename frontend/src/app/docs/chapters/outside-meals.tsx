import { FileText } from 'lucide-react';

import { type DocsChapter } from './chapter-types';
export const outsideMealsChapter: DocsChapter = {
  id: 'outside-meals',
  title: 'Food outside your plan',
  shortTitle: 'Food logging',
  group: 'Use KAINARA',
  icon: FileText,
  tone: 'amber',
  summary: 'Log food eaten outside the plan without treating that log as a verified recipe.',
  sections: [
    {
      id: 'outside-meals-log',
      title: 'Recording food or a snack',
      content: (
        <>
          <p>
            Record a meal, snack, drink, or individual food you actually consumed outside the plan. Enter known
            ingredients and portion details when available. Nutrition may be estimated or incomplete. An allergy or
            condition warning is not a substitute for checking the real food, packaging, and preparation.
          </p>
          <p>
            A useful entry identifies the food and any known ingredients. Grams and preparation notes help narrow an AI
            estimate but are optional; without them, the estimate assumes a typical serving and remains provisional.
            Restaurant recipes, sauces, cooking oils, and shared equipment may not be visible to KAINARA.
          </p>
          <p>
            If a warning appears, check the food directly and follow the advice of your own healthcare professional for
            serious allergies or medical restrictions. An absent warning does not prove that an unlisted ingredient or
            cross-contact is absent.
          </p>
        </>
      ),
    },
    {
      id: 'outside-meals-library',
      title: 'Proposing a reusable recipe',
      content: (
        <>
          <p>
            An outside log records your consumption. With separate consent, a reusable recipe proposal may enter meal
            verification. Neither the log nor the proposal automatically becomes a verified base recipe or a
            health-context case approval.
          </p>
          <p>
            This separation lets you track a meal without publishing it to other members. If you separately propose it
            for the catalogue, a nutritionist first checks the submitted dish as a general recipe. Only after that meal
            verification can it join the verified base library, and its ingredient, portion, and nutrition evidence
            still determine whether planning can use it.
          </p>
        </>
      ),
    },
  ],
};
