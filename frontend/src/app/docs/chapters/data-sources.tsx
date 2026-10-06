import { BrainCircuit } from 'lucide-react';
import { evidenceRegisterSections } from '../EvidenceRegister';

import { inlineLink, type DocsChapter } from './chapter-types';
export const dataSourcesChapter: DocsChapter = {
  id: 'data-sources',
  title: 'Sources and evidence',
  shortTitle: 'Sources and evidence',
  group: 'Review and evidence',
  icon: BrainCircuit,
  tone: 'cyan',
  summary:
    'The methods, Philippine nutrition data, safety guidance, and recipe sources behind KAINARA, with each source’s role and limits stated clearly.',
  sections: [
    {
      id: 'data-sources-reference',
      title: 'Published recipes and composition',
      content: (
        <>
          <p>
            Panlasang Pinoy supplies source recipes and attributed images or links where available. The DOST-FNRI
            Philippine Food Composition Tables provide food-level nutrient references. Other configured composition
            records may supplement a missing match. These sources do not establish laboratory-measured nutrients for
            every whole recipe or a confirmed edible weight for every ingredient.
          </p>
          <p>
            The recipe source describes a dish and its preparation. A food-composition table describes individual food
            items, often for a defined edible amount. Connecting an ingredient phrase from a recipe to a composition
            record requires an identity match, and turning household measures into nutrient totals requires usable
            amounts. A familiar name alone cannot fill a missing weight or resolve a vague ingredient.
          </p>
          <p>
            The full source register appears below. You can also inspect the{' '}
            <a
              href="https://i.fnri.dost.gov.ph/fct/library"
              className={inlineLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              official PhilFCT resource
            </a>{' '}
            directly.
          </p>
        </>
      ),
    },
    {
      id: 'data-sources-estimates',
      title: 'AI estimates and labels',
      content: (
        <>
          <p>
            Gemini can draft meal candidates and assist with some estimates. Generated values are checked against
            structured rules and may still need professional review. Recipe verification and case-review statuses
            describe their respective decisions; a displayed nutrient value is not proof of a laboratory measurement.
          </p>
          <p>
            An AI-produced meal name or nutrient number is a proposal, not measured food data. The system checks
            available structure and restrictions before saving a candidate, and a restricted case may still wait for a
            nutritionist. If a needed ingredient, serving, or source detail cannot be established, the application
            should show that gap rather than treating an estimate as confirmed composition.
          </p>
        </>
      ),
    },
    ...evidenceRegisterSections,
  ],
};
