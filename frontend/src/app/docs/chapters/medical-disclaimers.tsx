import { ShieldAlert } from 'lucide-react';

import { type DocsChapter } from './chapter-types';
export const medicalDisclaimersChapter: DocsChapter = {
  id: 'medical-disclaimers',
  title: 'Medical Disclaimers',
  shortTitle: 'Medical Disclaimers',
  group: 'Policies and help',
  icon: ShieldAlert,
  tone: 'amber',
  summary:
    'KAINARA supports meal planning and education, with limits that matter most for allergies and medical conditions.',
  sections: [
    {
      id: 'medical-disclaimers-scope',
      title: 'Scope of the service',
      content: (
        <>
          <p>
            KAINARA is not a medical device, clinician, emergency service, diagnosis, prescription, or treatment plan.
            An AI result, published recipe, nutritionist review, and case approval each have different scopes. None
            guarantees freedom from allergens, cross-contact, preparation errors, or adverse effects.
          </p>
          <p>
            The app helps organize meal choices from the information and evidence recorded in it. A nutritionist&apos;s
            decision relates to the recipe, serving, and member context presented for that review; it does not certify
            an independently prepared dish or replace individualized medical care. AI estimates and recipe labels should
            be read with their stated limits.
          </p>
        </>
      ),
    },
    {
      id: 'medical-disclaimers-checks',
      title: 'Check the actual food',
      content: (
        <>
          <p>
            Nutrition data may be estimated, incomplete, or based on a different serving than what you eat. Check
            ingredients, labels, portions, and preparation, particularly for allergies and conditions. Discuss
            individual restrictions and medication-related diet changes with your own qualified healthcare professional.
          </p>
          <p>
            A named dish can be prepared in many ways. Sauces, oils, garnishes, packaged substitutes, and restaurant
            practices may change both nutrient amounts and allergen exposure. Compare the plan with the actual
            ingredients and packaging before eating. Seek qualified advice if your medical instructions conflict with a
            suggestion in the app.
          </p>
        </>
      ),
    },
  ],
};
