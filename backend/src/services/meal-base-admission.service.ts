import prisma from '@/lib/prisma';
import { createHash } from 'node:crypto';

type LibraryBase = {
  id: string;
  recipeSignature: string | null;
  description: string | null;
  sourceRawRecipeCandidateId: string | null;
  sourceRawRecipeCandidate?: {
    sourceName: string;
    status: string;
    contentSignature: string;
  } | null;
};

export function libraryBaseRevisionKey(recipeSignature: string, description: string | null): string {
  return createHash('sha256').update(JSON.stringify([recipeSignature, description?.normalize('NFKC').trim() ?? null])).digest('hex');
}

export function baseMealAdmissionMatches(meal: LibraryBase, verifiedKeys: ReadonlySet<string>): boolean {
  const source = meal.sourceRawRecipeCandidate;
  if (!meal.recipeSignature) return false;
  if (source?.sourceName === 'PANLASANG_PINOY' && source.status === 'AVAILABLE') return true;
  return verifiedKeys.has(`LIBRARY_MEAL:${meal.id}:${libraryBaseRevisionKey(meal.recipeSignature, meal.description)}`) ||
    verifiedKeys.has(`GENERATED_RECIPE:${meal.recipeSignature}:${meal.recipeSignature}`) ||
    Boolean(source?.status === 'AVAILABLE' && meal.sourceRawRecipeCandidateId &&
      verifiedKeys.has(`RAW_RECIPE:${meal.sourceRawRecipeCandidateId}:${source.contentSignature}`));
}

/** Verification follows the exact recipe revision. It grants no health clearance. */
export async function admittedLibraryBaseIds(meals: readonly LibraryBase[]): Promise<Set<string>> {
  if (meals.length === 0) return new Set();
  const alreadyAdmitted = new Set(meals.flatMap((meal) =>
    baseMealAdmissionMatches(meal, new Set()) ? [meal.id] : []));
  const needsVerification = meals.filter((meal) => !alreadyAdmitted.has(meal.id));
  if (needsVerification.length === 0) return alreadyAdmitted;
  const signatures = needsVerification.flatMap((meal) => meal.recipeSignature ? [meal.recipeSignature] : []);
  const ids = needsVerification.map((meal) => meal.id);
  const rawIds = needsVerification.flatMap((meal) => meal.sourceRawRecipeCandidateId ? [meal.sourceRawRecipeCandidateId] : []);
  const verified = await prisma.mealBaseVerification.findMany({
    where: {
      status: 'VERIFIED',
      OR: [
        { targetKind: 'LIBRARY_MEAL', targetId: { in: ids } },
        { targetKind: 'RAW_RECIPE', targetId: { in: rawIds } },
        { targetKind: 'GENERATED_RECIPE', targetId: { in: signatures } },
      ],
    },
    select: { targetKind: true, targetId: true, revisionKey: true },
  });
  const keys = new Set(verified.map((row) => `${row.targetKind}:${row.targetId}:${row.revisionKey}`));
  for (const meal of needsVerification) {
    if (baseMealAdmissionMatches(meal, keys)) alreadyAdmitted.add(meal.id);
  }
  return alreadyAdmitted;
}
