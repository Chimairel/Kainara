import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { lockUserProfile, advanceSafetyRevision } from './profile-revision.service';
import { NutritionReportService } from './nutrition-report.service';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { loadPlanningRules } from './planning-rule-screening.service';
import type { PatientNutritionLimitInput } from '@/validation/patient-nutrition-limit.schemas';
import type { Prisma } from '@prisma/client';
import { patientLimitScope } from '@/domain/planning-rule-screening.policy';

async function assertClaim(client: Prisma.TransactionClient, reviewerId: string, mealId: string) {
  const reviewer = await client.nutritionistProfile.findUnique({ where: { id: reviewerId },
    include: { user: { select: { role: true, isSuspended: true } } } });
  if (!reviewer || !isNutritionistEligibleForReview(reviewer)) throw new AppError('A current nutritionist credential is required.', 403, 'RND_CREDENTIAL_REQUIRED');
  const meal = await client.mealPlan.findUnique({ where: { id: mealId }, include: { user: { include: { userProfile: true, healthConditions: true } } } });
  if (!meal || meal.status !== 'PENDING_REVIEW' || meal.claimedByNutritionistId !== reviewerId ||
    !meal.claimedAt || meal.claimedAt.getTime() <= Date.now() - 30 * 60_000)
    throw new AppError('Claim the current meal case before managing this member’s limits.', 409, 'REVIEW_CLAIM_REQUIRED');
  return { reviewer, meal };
}

export class PatientNutritionLimitService {
  static async list(reviewerId: string, mealId: string) {
    const { meal } = await assertClaim(prisma, reviewerId, mealId);
    const limits = await prisma.patientNutritionLimit.findMany({ where: { userId: meal.userId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 200 });
    const defaults = await loadPlanningRules(meal.userId, meal.user.healthConditions.map(row => row.condition));
    return { limits, defaultRules: defaults.rules, profileRevision: meal.user.userProfile!.revision };
  }

  static async save(reviewerId: string, mealId: string, input: PatientNutritionLimitInput) {
    const opened = await assertClaim(prisma, reviewerId, mealId);
    return prisma.$transaction(async tx => {
      await lockUserProfile(tx, opened.meal.userId);
      const { meal, reviewer } = await assertClaim(tx, reviewerId, mealId);
      if (meal.user.userProfile?.revision !== input.expectedProfileRevision)
        throw new AppError('The profile changed. Reopen the case.', 409, 'MEAL_REVIEW_CONTEXT_CHANGED');
      if (!meal.user.healthConditions.some(row => row.condition === input.condition))
        throw new AppError('This condition is not recorded for this member.', 422, 'CONDITION_NOT_RECORDED');
      if (input.replacesRuleId) {
        const source = await tx.conditionNutrientRule.findUnique({ where: { id: input.replacesRuleId } });
        if (!source || source.condition !== input.condition || source.nutrient !== input.nutrient || source.basis !== input.basis)
          throw new AppError('An override must match the named default’s condition, nutrient and calculation basis.', 422, 'LIMIT_SCOPE_MISMATCH');
      }
      const { expectedProfileRevision: _revision, validFrom, validUntil, ...data } = input;
      void _revision;
      const scopeKey = patientLimitScope(input);
      const latest = await tx.patientNutritionLimit.aggregate({ where: { userId: meal.userId, scopeKey }, _max: { version: true } });
      const limit = await tx.patientNutritionLimit.create({ data: { ...data, userId: meal.userId, nutritionistProfileId: reviewerId,
        scopeKey, version: (latest._max.version ?? 0) + 1, validFrom: new Date(validFrom), validUntil: validUntil ? new Date(validUntil) : null } });
      await advanceSafetyRevision(tx, meal.userId);
      await NutritionReportService.publishInTransaction(tx, meal.userId);
      await tx.auditEvent.create({ data: { actorUserId: reviewer.userId, action: 'PATIENT_NUTRITION_LIMIT_SET', entityType: 'PatientNutritionLimit', entityId: limit.id,
        metadata: { userId: meal.userId, mealId, replacesRuleId: limit.replacesRuleId, version: limit.version } } });
      return limit;
    }, { timeout: 30_000 });
  }

  static async revoke(reviewerId: string, mealId: string, limitId: string, reason: string) {
    const opened = await assertClaim(prisma, reviewerId, mealId);
    return prisma.$transaction(async tx => {
      await lockUserProfile(tx, opened.meal.userId);
      const { meal, reviewer } = await assertClaim(tx, reviewerId, mealId);
      const limit = await tx.patientNutritionLimit.findFirst({ where: { id: limitId, userId: meal.userId } });
      if (!limit) throw new AppError('Limit not found for this member.', 404, 'LIMIT_NOT_FOUND');
      if (limit.revokedAt) return limit;
      const result = await tx.patientNutritionLimit.update({ where: { id: limitId }, data: { revokedAt: new Date() } });
      await advanceSafetyRevision(tx, meal.userId);
      await NutritionReportService.publishInTransaction(tx, meal.userId);
      await tx.auditEvent.create({ data: { actorUserId: reviewer.userId, action: 'PATIENT_NUTRITION_LIMIT_REVOKED', entityType: 'PatientNutritionLimit', entityId: limitId, metadata: { reason, mealId, userId: meal.userId } } });
      return result;
    }, { timeout: 30_000 });
  }
}
