import { HeartPulse } from '@/components/ui/icons';

import { type DocsChapter } from './chapter-types';
export const clinicalGuidelinesChapter: DocsChapter = {
  id: 'clinical-guidelines',
  title: 'Clinical Guidelines',
  shortTitle: 'Clinical Guidelines',
  group: 'Review and evidence',
  icon: HeartPulse,
  tone: 'amber',
  aliases: ['clinical-safety'],
  summary: 'Accurate declarations and current review evidence are central to restriction-aware planning.',
  sections: [
    {
      id: 'clinical-guidelines-profile',
      title: 'Keep the profile accurate',
      content: (
        <>
          <p>
            Enter diagnosed conditions, allergies, medications or relevant risk context truthfully and update them when
            they change. A vague entry may need correction. Some conditions require reviewed documents; an RND may also
            request evidence for a specific declared area. Do not upload another person&apos;s record, and cover
            unrelated identifiers before submitting a supporting file.
          </p>
          <p>
            The system can only compare meals against the restrictions it has recorded. For example, a broad label may
            not contain the severity or subtype needed for a useful decision. An RND can ask for clarification or
            supporting evidence before confirming that the profile is specific enough for planning. If the information
            is already sufficient, the reviewer can document an assessment and resolve the clarification without
            proposing an unnecessary correction.
          </p>
          <p>
            A document review checks whether the submitted material supplies relevant nutrition context. It is not a
            medical diagnosis or a guarantee that the file is authentic. If a condition, medication, allergy, or
            clinical instruction changes later, update the profile rather than relying on an older review.
          </p>
        </>
      ),
    },
    {
      id: 'clinical-guidelines-gates',
      title: 'Review gates',
      content: (
        <>
          <p>
            Profiles with declared health conditions or unclear restrictions may need a current profile decision,
            followed by a meal-specific case decision where required. Clearly recorded, known allergies, intolerances,
            and foods to avoid use ingredient filtering and do not automatically require a whole-profile review.
            Flags and specific review policies can require an independent reviewer. Ingredient conflicts, missing evidence, flags, expired approvals, and
            changed profiles can block use. RNDs assess recorded evidence; they do not diagnose through this app.
          </p>
          <p>
            Profile confirmation allows the system to prepare candidates for the declared restrictions. It does not
            approve all meals bearing a matching condition label. The case review checks a particular ingredient set and
            serving against the recorded context, and an approval can be reused only within that scope while it remains
            current.
          </p>
          <p>
            These checks are deliberately separate. A verified recipe may still have incomplete nutrition evidence. A
            suitable serving may still lack a case decision. A previously approved case may be paused after a flag,
            source change, or manual flag. The status shown with the meal indicates which step is still outstanding.
          </p>
        </>
      ),
    },
    {
      id: 'clinical-guidelines-urgent',
      title: 'Urgent concerns',
      content: (
        <>
          <p>
            If you have a severe reaction, symptoms, or an urgent medical concern, seek in-person or emergency care. Do
            not rely on KAINARA to identify or manage an emergency.
          </p>
          <p>
            Meal planning cannot account for every ingredient substitution, preparation mistake, cross-contact event, or
            change in a person&apos;s health. Follow an existing care plan from your qualified healthcare professional
            and use local emergency services when urgent help is needed.
          </p>
        </>
      ),
    },
  ],
};
