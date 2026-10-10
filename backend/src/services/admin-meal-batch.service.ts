import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { adminMealInputSchema, type AdminMealInput } from '@/validation/admin-meal.schemas';
import { createAdminMealDraft, resolveIngredients, recipeSignature } from './admin-meal-authoring.service';
import { digest, json, reviewActor } from './meal-review-context.service';

const envelope = z
  .object({ format: z.literal('KAINARA_MEALS_V1'), meals: z.array(z.unknown()).min(1).max(100) })
  .strict();
const limits = (input: unknown) => {
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 2 * 1024 * 1024)
    throw new AppError('JSON batches are limited to 2 MB.', 413, 'BATCH_TOO_LARGE');
  const parsed = envelope.safeParse(input);
  if (!parsed.success)
    throw new AppError('Use KAINARA_MEALS_V1 with 1–100 meals and no extra envelope fields.', 422, 'BATCH_INVALID');
  return parsed.data;
};

async function validateBatch(tx: Prisma.TransactionClient, input: unknown) {
  const batch = limits(input);
  const seen = new Set<string>();
  const meals: AdminMealInput[] = [];
  const results: { index: number; mealName: string | null; errors: string[] }[] = [];
  for (const [index, candidate] of batch.meals.entries()) {
    const parsed = adminMealInputSchema.safeParse(candidate);
    const result = {
      index,
      mealName:
        typeof candidate === 'object' && candidate && 'mealName' in candidate ? String(candidate.mealName) : null,
      errors: [] as string[],
    };
    if (!parsed.success)
      result.errors = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'meal'}: ${issue.message}`);
    else {
      try {
        const ingredients = await resolveIngredients(tx, parsed.data);
        const signature = recipeSignature(parsed.data, ingredients);
        if (
          seen.has(signature) ||
          (await tx.mealLibrary.findUnique({ where: { recipeSignature: signature }, select: { id: true } }))
        )
          result.errors.push('This exact recipe already exists in the library or this batch.');
        seen.add(signature);
        meals.push(parsed.data);
      } catch (error) {
        result.errors.push(error instanceof AppError ? error.message : 'Ingredient mappings could not be validated.');
      }
    }
    results.push(result);
  }
  return { batch, meals, results, valid: results.every((row) => !row.errors.length) };
}

export class AdminMealBatchService {
  static template() {
    return {
      format: 'KAINARA_MEALS_V1',
      meals: [
        {
          mealName: '',
          mealType: 'DINNER',
          summary: '',
          instructions: '',
          nutritionBasis: '',
          nutritionServingDescription: '',
          calories: null,
          proteinG: null,
          carbsG: null,
          fatG: null,
          sodiumMg: null,
          sugarG: null,
          fiberG: null,
          potassiumMg: null,
          phosphorusMg: null,
          saturatedFatG: null,
          ingredients: [{ foodItemId: '', gramsPerServing: null }],
        },
      ],
    };
  }

  static async export(ids: string[]) {
    if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
      throw new AppError('Select 1–100 distinct meals.', 422, 'BATCH_SELECTION_INVALID');
    const rows = await prisma.mealLibrary.findMany({
      where: { id: { in: ids } },
      include: {
        ingredients: { orderBy: { position: 'asc' }, include: { foodItem: { select: { source: true } } } },
        safetyReviews: { where: { reasonCode: 'ADMIN_AUTHORED_DRAFT' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (rows.length !== ids.length)
      throw new AppError('One or more selected meals are unavailable.', 404, 'MEAL_NOT_FOUND');
    const byId = new Map(rows.map((row) => [row.id, row]));
    const output = {
      format: 'KAINARA_MEALS_V1',
      meals: ids.map((id) => {
        const row = byId.get(id)!;
        const snapshot = row.safetyReviews[0]?.evidenceSnapshot as
          { summary?: string; instructions?: string; nutritionBasis?: string } | undefined;
        const [description, instructions] = (row.description ?? '').split('\n\nPreparation instructions:\n');
        return {
          mealName: row.mealName,
          mealType: row.mealType,
          summary: snapshot?.summary ?? description,
          instructions: snapshot?.instructions ?? instructions ?? '',
          nutritionBasis: snapshot?.nutritionBasis ?? '',
          nutritionServingDescription: row.nutritionServingDescription ?? '',
          calories: row.calories,
          proteinG: row.proteinG,
          carbsG: row.carbsG,
          fatG: row.fatG,
          sodiumMg: row.sodiumMg,
          sugarG: row.sugarG,
          fiberG: row.fiberG,
          potassiumMg: row.potassiumMg,
          phosphorusMg: row.phosphorusMg,
          saturatedFatG: row.saturatedFatG,
          ingredients: row.ingredients.map((item) => ({
            foodItemId: item.foodItem?.source === 'FNRI' ? item.foodItemId : '',
            gramsPerServing: item.unit === 'g' ? item.quantity : null,
          })),
        };
      }),
    };
    if (Buffer.byteLength(JSON.stringify(output), 'utf8') > 2 * 1024 * 1024)
      throw new AppError('Selected export exceeds 2 MB. Export fewer meals.', 413, 'BATCH_TOO_LARGE');
    return output;
  }

  static async preview(userId: string, input: unknown) {
    const hash = digest(limits(input));
    return prisma.$transaction(
      async (tx) => {
        await reviewActor(tx, userId);
        const previous = await tx.mealBatchImport.findFirst({
          where: { actorUserId: userId, payloadHash: hash, importedAt: { not: null } },
          select: { id: true, result: true },
        });
        if (previous)
          return { previewId: previous.id, valid: true, alreadyImported: true, imported: previous.result, results: [] };
        const validation = await validateBatch(tx, input);
        const preview = validation.valid
          ? await tx.mealBatchImport.create({
              data: { actorUserId: userId, payloadHash: hash, payload: json(validation.batch) },
            })
          : null;
        return {
          previewId: preview?.id ?? null,
          valid: validation.valid,
          alreadyImported: false,
          results: validation.results,
        };
      },
      { timeout: 60_000 }
    );
  }

  static async import(userId: string, previewId: string) {
    return prisma.$transaction(
      async (tx) => {
        await reviewActor(tx, userId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`meal-batch:${previewId}`}))`;
        const preview = await tx.mealBatchImport.findFirst({ where: { id: previewId, actorUserId: userId } });
        if (!preview) throw new AppError('Batch preview not found for this account.', 404, 'BATCH_PREVIEW_NOT_FOUND');
        if (preview.importedAt) return { replayed: true, meals: preview.result };
        const validation = await validateBatch(tx, preview.payload);
        if (!validation.valid)
          throw new AppError(
            'Batch changed or contains invalid mappings or duplicates. Preview again.',
            409,
            'BATCH_REVALIDATION_FAILED',
            validation.results
          );
        const meals = [];
        for (const input of validation.meals) meals.push(await createAdminMealDraft(tx, userId, input));
        await tx.mealBatchImport.update({
          where: { id: preview.id },
          data: { result: json(meals), importedAt: new Date() },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: userId,
            action: 'ADMIN_MEAL_BATCH_IMPORTED',
            entityType: 'MealBatchImport',
            entityId: preview.id,
            metadata: { count: meals.length, unverifiedDrafts: true },
          },
        });
        return { replayed: false, meals };
      },
      { maxWait: 10_000, timeout: 120_000 }
    );
  }
}
