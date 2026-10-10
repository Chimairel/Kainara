import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoots = [resolve(root, 'backend/src'), resolve(root, 'frontend/src')];
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const maximumLines = 900;
// These extracted entry points compose features; implementation belongs in their feature/workflow modules.
const entryPointLimits = new Map([
  ['frontend/src/app/(user)/dashboard/page.tsx', 60],
  ['frontend/src/app/(user)/meals/page.tsx', 60],
  ['frontend/src/app/(user)/grocery/page.tsx', 60],
  ['frontend/src/components/landing/LandingHome.tsx', 60],
  ['frontend/src/app/docs/DocsChapters.tsx', 60],
  ['frontend/src/features/dashboard/OutsideMealModal.tsx', 60],
  ['frontend/src/components/user/ProgressWorkspace.tsx', 200],
  ['frontend/src/components/user/MealActivityCalendar.tsx', 100],
  ['frontend/src/components/user/MealCard.tsx', 160],
  ['frontend/src/components/user/MealHistoryCard.tsx', 130],
  ['frontend/src/features/admin-analytics/AdminStatistics.tsx', 120],
  ['frontend/src/features/profile/AccountSettings.tsx', 170],
  ['frontend/src/app/(nutritionist)/nutritionist/reviews/ProfileWorkPanel.tsx', 150],
  ['frontend/src/app/(nutritionist)/nutritionist/outside-meals/OutsideMealReviewsPanel.tsx', 100],
  ['frontend/src/app/(nutritionist)/nutritionist/profile/page.tsx', 150],
  ['frontend/src/features/nutritionist-library/SharedMealLibraryWorkspace.tsx', 120],
  ['frontend/src/features/nutritionist-reviews/CaseReviewWorkspace.tsx', 250],
  ['frontend/src/features/meals/MealsWorkspaceModals.tsx', 225],
  ['frontend/src/features/nutritionist-application/ApplicationWizard.tsx', 150],
  ['backend/src/controllers/meals.controller.ts', 100],
  ['backend/src/services/auth.service.ts', 100],
  ['backend/src/services/meal-plan-composition.service.ts', 800],
  ['backend/src/services/clinical-evidence.service.ts', 800],
  ['frontend/src/features/meals/useMealsWorkspace.ts', 700],
  ['frontend/src/features/nutritionist-reviews/useNutritionistReviews.ts', 600],
]);

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return sourceExtensions.has(extname(entry.name)) && statSync(path).isFile() ? [path] : [];
  });
}

const violations = sourceRoots
  .flatMap(collectFiles)
  .map((path) => ({
    path,
    lines: readFileSync(path, 'utf8').split(/\r?\n/).length,
    limit: entryPointLimits.get(relative(root, path).replaceAll('\\', '/')) ?? maximumLines,
  }))
  .filter(({ lines, limit }) => lines > limit)
  .sort((left, right) => right.lines - left.lines);

if (violations.length > 0) {
  console.error('Source architecture check failed: handwritten modules exceed their line budgets.');
  for (const violation of violations) {
    console.error(`- ${relative(root, violation.path)}: ${violation.lines} lines (limit ${violation.limit})`);
  }
  console.error('Split state, transport, policy, presentation, or fixtures by responsibility before adding more code.');
  process.exitCode = 1;
} else {
  console.log(`Source architecture check passed: every handwritten source module is <= ${maximumLines} lines.`);
  console.log(
    `Extracted entry-point budgets passed for ${entryPointLimits.size} composition/controller/service files.`
  );
}
