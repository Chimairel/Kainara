import { policyChapters } from './DocsPolicies';
import { membershipChapter } from './DocsMembership';
import type { DocsChapter } from './chapters/chapter-types';
export type { DocsChapter, DocsSection } from './chapters/chapter-types';
import { whatIsKainaraChapter } from './chapters/what-is-kainara';
import { gettingStartedChapter } from './chapters/getting-started';
import { mealPlanningChapter } from './chapters/meal-planning';
import { mealLibraryChapter } from './chapters/meal-library';
import { trackingChapter } from './chapters/tracking';
import { outsideMealsChapter } from './chapters/outside-meals';
import { mealSwapsChapter } from './chapters/meal-swaps';
import { groceriesChapter } from './chapters/groceries';
import { professionalReviewChapter } from './chapters/professional-review';
import { dataSourcesChapter } from './chapters/data-sources';
import { clinicalGuidelinesChapter } from './chapters/clinical-guidelines';
import { medicalDisclaimersChapter } from './chapters/medical-disclaimers';
export const docsChapters: DocsChapter[] = [
  whatIsKainaraChapter,
  gettingStartedChapter,
  mealPlanningChapter,
  mealLibraryChapter,
  trackingChapter,
  outsideMealsChapter,
  mealSwapsChapter,
  groceriesChapter,
  membershipChapter,
  professionalReviewChapter,
  dataSourcesChapter,
  clinicalGuidelinesChapter,
  medicalDisclaimersChapter,
  ...policyChapters,
];
