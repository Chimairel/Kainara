import prisma from '@/lib/prisma';
import { MealBaseVerificationService } from './meal-base-verification.service';
import { isReviewClaimActive } from '@/domain/nutritionist-review.policy';

/** One navigation queue; each target keeps its existing guarded decision service. */
export class MealVerificationWorkspaceService {
  static async list(profileId: string) {
    const [fresh, flagged] = await Promise.all([
      MealBaseVerificationService.list(profileId),
      prisma.mealReviewLineage.findMany({
        where: { state: 'PENDING_REREVIEW', meals: { some: { status: 'FLAGGED' } } },
        orderBy: { createdAt: 'asc' }, take: 100,
        include: {
          meals: { where: { status: 'FLAGGED' }, orderBy: { id: 'asc' }, take: 1,
            select: { id: true, mealName: true, mealType: true, description: true, calories: true, proteinG: true, carbsG: true, fatG: true } },
          incidents: { where: { state: 'PENDING_REREVIEW', closedAt: null }, orderBy: { number: 'desc' }, take: 1,
            include: { reports: { select: { actorNutritionistId: true } } } },
        },
      }),
    ]);
    const incidents = flagged.flatMap(lineage => {
      const meal = lineage.meals[0], incident = lineage.incidents[0];
      if (!meal || !incident) return [];
      const involved = (Array.isArray(incident.excludedReviewerIds) && incident.excludedReviewerIds.includes(profileId)) ||
        incident.reports.some(report => report.actorNutritionistId === profileId);
      return [{ kind: 'FLAGGED_RECIPE' as const, id: meal.id, name: meal.mealName, revisionKey: incident.id,
        description: meal.description, mealType: meal.mealType, source: 'FLAGGED_RECIPE', status: 'FLAGGED' as const,
        calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG, ingredients: [],
        incidentNumber: incident.number, reviewerInvolved: involved,
        claimedByMe: incident.claimedByNutritionistId === profileId && isReviewClaimActive(incident),
        claimedByOther: Boolean(incident.claimedByNutritionistId && incident.claimedByNutritionistId !== profileId && isReviewClaimActive(incident)) }];
    });
    return [...incidents, ...fresh].sort((a, b) => Number(b.claimedByMe) - Number(a.claimedByMe));
  }
}
