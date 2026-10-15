import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { env } from '@/config/env';
import {
  object,
  reusableClinicalContextKey,
  referenceServingDigest,
  referencePlateFacts,
  REVIEW_REFERENCE_POLICY,
} from '@/domain/reusable-review-reference.policy';
import { clarificationQuestionsSchema } from '@/domain/clinical-clarification.policy';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { currentReviewProfile, recipeLineageKey } from './meal-review-context.service';
import { admittedLibraryBaseIds } from './meal-base-admission.service';
import { certifiedLibraryMealInclude } from './meal-library-candidate-query.service';

type OpenedContext = { snapshot: Prisma.InputJsonObject; scopeKey: string; profileRevision: number };
export async function matchingReviewKeys(tx: Prisma.TransactionClient, opened: OpenedContext) {
  const snapshot = opened.snapshot,
    meal = object(snapshot.meal),
    userId = String(snapshot.userId);
  // Meal-specific answers stay in their own review rather than another member's reference.
  if (Array.isArray(snapshot.mealQuestions) && snapshot.mealQuestions.length) return null;
  const facts = referencePlateFacts(snapshot);
  if (
    !facts ||
    !env.JWT_SECRET ||
    typeof meal.baseRecipeSignature !== 'string' ||
    typeof meal.composedServingSignature !== 'string'
  )
    return null;
  const forms = await tx.clinicalClarificationForm.findMany({
    relationLoadStrategy: 'join',
    where: { userId, purpose: 'PROFILE', profileRevision: opened.profileRevision, scopeKey: opened.scopeKey },
    include: { responses: { orderBy: { version: 'desc' }, take: 1 }, resolution: true },
  });
  const resolvedForms: unknown[] = [];
  for (const form of forms) {
    const latest = form.responses[0];
    if (!latest || form.resolution?.responseId !== latest.id) return null;
    const questions = clarificationQuestionsSchema.parse(form.questions),
      answers = object(latest.answers);
    resolvedForms.push(
      questions.map((question) => ({
        label: question.label,
        type: question.type,
        required: question.required,
        options: question.type === 'CHOICE' ? question.options : null,
        answer: answers[question.id] ?? null,
      }))
    );
  }
  const contextKey = reusableClinicalContextKey(snapshot, resolvedForms, env.JWT_SECRET);
  if (!contextKey) return null;
  let source: unknown = null;
  if (typeof meal.libraryMealId === 'string') {
    const library = await tx.mealLibrary.findFirst({
      relationLoadStrategy: 'join',
      where: { id: meal.libraryMealId },
      include: certifiedLibraryMealInclude,
    });
    if (
      !library ||
      !(await admittedLibraryBaseIds([library], tx)).has(library.id) ||
      library.recipeSignature !== meal.baseRecipeSignature
    )
      return null;
    const key = await recipeLineageKey(tx, library.id);
    const lineage = await tx.mealReviewLineage.findUnique({ where: { key }, select: { state: true } });
    if (lineage && lineage.state !== 'PUBLISHED') return null;
    source = {
      signature: library.recipeSignature,
      revision: library.safetyEvidenceRevision,
      nutrients: {
        sodiumMg: library.sodiumMg,
        sugarG: library.sugarG,
        fiberG: library.fiberG,
        potassiumMg: library.potassiumMg,
        phosphorusMg: library.phosphorusMg,
        saturatedFatG: library.saturatedFatG,
      },
    };
  } else if (typeof meal.sourceRawRecipeCandidateId === 'string') {
    const raw = await tx.rawRecipeCandidate.findUnique({
      where: { id: meal.sourceRawRecipeCandidateId },
      select: {
        contentSignature: true,
        sourceName: true,
        status: true,
        libraryVariants: { where: { status: { in: ['FLAGGED', 'ARCHIVED'] } }, select: { id: true }, take: 1 },
      },
    });
    const lineage = await tx.mealReviewLineage.findUnique({
      where: { key: `source:${meal.sourceRawRecipeCandidateId}` },
      select: { state: true },
    });
    if (!raw || raw.status !== 'AVAILABLE' || raw.libraryVariants.length || (lineage && lineage.state !== 'PUBLISHED'))
      return null;
    if (
      raw.sourceName !== 'PANLASANG_PINOY' &&
      !(await tx.mealBaseVerification.findFirst({
        where: {
          targetKind: 'RAW_RECIPE',
          targetId: meal.sourceRawRecipeCandidateId,
          revisionKey: raw.contentSignature,
          status: 'VERIFIED',
        },
        select: { id: true },
      }))
    )
      return null;
    source = { rawSignature: raw.contentSignature };
  } else if (meal.candidateProvenance === 'AI_FROM_SCRATCH') {
    const verified = await tx.mealBaseVerification.findFirst({
      where: {
        targetKind: 'GENERATED_RECIPE',
        targetId: meal.baseRecipeSignature,
        revisionKey: meal.baseRecipeSignature,
        status: 'VERIFIED',
      },
      select: { id: true },
    });
    const held = await tx.mealLibrary.findFirst({
      where: {
        recipeSignature: meal.baseRecipeSignature,
        status: { in: ['FLAGGED', 'ARCHIVED'] },
      },
      select: { id: true },
    });
    if (!verified || held) return null;
    source = { generatedSignature: meal.baseRecipeSignature };
  } else return null;
  const ingredients = (Array.isArray(meal.ingredients) ? meal.ingredients : [])
    .map((value) => {
      const item = object(value),
        food = object(item.foodItem);
      return {
        name: item.ingredientName,
        quantity: item.quantity,
        unit: item.unit,
        dataSource: item.dataSource,
        food: {
          id: food.id,
          compositionRevision: food.compositionRevision,
          calories: food.calories,
          proteinG: food.proteinG,
          carbsG: food.carbsG,
          fatG: food.fatG,
          sodium: food.sodium,
          sugar: food.sugar,
          fiber: food.fiber,
          potassium: food.potassium,
          phosphorus: food.phosphorus,
          saturatedFat: food.saturatedFat,
        },
      };
    })
    .sort((a, b) => referenceServingDigest(a).localeCompare(referenceServingDigest(b)));
  const components = (Array.isArray(meal.servingComponents) ? meal.servingComponents : [])
    .map((value) => {
      const item = object(value);
      return {
        type: item.componentType,
        quantityG: item.quantityG,
        food: item.foodItem ? { ...object(item.foodItem), aliases: undefined } : null,
      };
    })
    .sort((a, b) => referenceServingDigest(a).localeCompare(referenceServingDigest(b)));
  return {
    contextKey,
    legacyContextKey: reusableClinicalContextKey(snapshot, resolvedForms, env.JWT_SECRET, 'EXACT_REVIEW_REFERENCE_V1'),
    servingKey: referenceServingDigest({
      source,
      signature: meal.baseRecipeSignature,
      composed: meal.composedServingSignature,
      mealType: meal.mealType,
      facts,
      ingredients,
      components,
    }),
    facts,
  };
}

/** Capture new immutable decisions only. Never derive a historical reference from today's profile. */
export async function captureReviewReference(tx: Prisma.TransactionClient, decisionId: string, opened: OpenedContext) {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) return;
  const keys = await matchingReviewKeys(tx, opened);
  if (!keys) return;
  return tx.mealReviewReference.create({
    data: {
      decisionId,
      policyVersion: REVIEW_REFERENCE_POLICY,
      contextKey: keys.contextKey,
      servingKey: keys.servingKey,
      plateFacts: keys.facts,
    },
  });
}

export async function listReviewReferences(opened: OpenedContext, reviewerId: string) {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) return [];
  if (!(await currentReviewProfile(prisma, reviewerId))) return [];
  const keys = await matchingReviewKeys(prisma, opened);
  if (!keys) return [];
  const rows = await prisma.mealReviewReference.findMany({
    relationLoadStrategy: 'join',
    where: { policyVersion: REVIEW_REFERENCE_POLICY, contextKey: keys.contextKey, servingKey: keys.servingKey },
    include: {
      decision: {
        include: {
          nutritionistProfile: { include: { user: true } },
          mealPlan: {
            select: {
              status: true,
              profileApproval: { select: { flaggedAt: true } },
              reviewDecisions: { orderBy: { submittedAt: 'desc' }, take: 1, select: { id: true, decision: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows
    .filter(
      (row) =>
        row.decision.decision === 'APPROVE' &&
        isNutritionistEligibleForReview(row.decision.nutritionistProfile) &&
        !['DISPUTED', 'REJECTED'].includes(row.decision.mealPlan.status) &&
        !row.decision.mealPlan.profileApproval?.flaggedAt &&
        row.decision.mealPlan.reviewDecisions[0]?.id === row.decisionId
    )
    .slice(0, 5)
    .map((row) => ({
      reviewedAt: row.decision.submittedAt,
      reviewerName:
        typeof object(object(row.decision.evidenceSnapshot).reviewedBy).name === 'string'
          ? (object(object(row.decision.evidenceSnapshot).reviewedBy).name as string)
          : null,
      decision: 'APPROVE' as const,
      plateFacts: referencePlateFacts({ meal: row.plateFacts }),
      match: 'Exact recorded profile, clinical inputs, clarifications and recipe serving' as const,
      use: 'An active approval can be reused when every recorded input and serving matches' as const,
    }));
}
