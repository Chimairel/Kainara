import prisma from '@/lib/prisma';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { publishedExtendedNutrients } from '@/domain/review-plate-nutrients.policy';
import { VerifiedRecipeCatalogService } from './verified-recipe-catalog.service';
import { queryEligibleLibraryPage } from './meal-library-candidate-query.service';
import type { AssistantReply } from './member-assistant.service';

const nutrients = [
  ['calories', 'Energy', 'kcal'], ['proteinG', 'Protein', 'g'], ['carbsG', 'Carbohydrates', 'g'], ['fatG', 'Fat', 'g'],
  ['sodiumMg', 'Sodium', 'mg'], ['sugarG', 'Sugar', 'g'], ['fiberG', 'Fiber', 'g'], ['potassiumMg', 'Potassium', 'mg'],
  ['phosphorusMg', 'Phosphorus', 'mg'], ['saturatedFatG', 'Saturated fat', 'g'],
] as const;
const normalized = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Read-only nutrition for recipes visible through the member's existing library.
 * No personal approval, portion conversion, ingredient estimate or shared member cache.
 */
export class MemberAssistantRecipeFactsService {
  static async facts(userId: string, search: string): Promise<AssistantReply | null> {
    const page = await VerifiedRecipeCatalogService.list(userId, { search, page: 1 });
    let matches = page.items.map(row => ({ id: row.id, name: row.name }));
    let total = page.total;
    if (page.restrictedProfile) {
      // Restricted members see the same compatible/profile-approved collection
      // that accompanies the browse catalogue in the Library tab.
      const context = await loadPlanningNutritionContext(prisma, userId, 'Member profile not found.');
      const eligible = await queryEligibleLibraryPage({ userId, search, limit: 6, safetyOnly: true,
        includeProfileApproved: true, userConditions: context.conditions, userAllergens: context.allergens,
        profile: { ...context.profile, userId, safetyEntries: context.user.safetyProfileEntries } });
      matches = eligible.items.map(row => ({ id: row.id, name: row.mealName }));
      total = eligible.total;
    }
    if (!matches.length) return null;
    const exact = matches.filter(row => normalized(row.name) === normalized(search));
    const chosen = exact.length === 1 ? exact[0] : total === 1 ? matches[0] : null;
    const links = [{ label: 'Open meal library', href: '/meals?tab=library' }];
    if (!chosen) return {
      text: `I found matching recipes in your meal library. Which recipe do you mean?\n${matches.slice(0, 5).map(row => `• ${row.name}`).join('\n')}\n${total > 5 ? 'More variants are available in the library. ' : ''}Tell me the full recipe name. Nutrition differs by recipe and serving; I haven’t selected one or assumed a generic value.`,
      source: 'AI', creditsUsed: 1, links,
    };
    let values: Record<string, unknown>;
    let sourceUrl: string | null = null;
    let attribution: string;
    let serving = 'One recorded recipe serving';
    if (chosen.id.startsWith('raw:')) {
      const row = await prisma.rawRecipeCandidate.findFirst({ where: { id: chosen.id.slice(4),
        sourceName: 'PANLASANG_PINOY', status: 'AVAILABLE', libraryVariants: { none: { status: 'FLAGGED' } } },
        select: { calories: true, proteinG: true, carbsG: true, fatG: true,
          publishedNutrition: true, sourceName: true, sourceUrl: true } });
      if (!row) return null;
      values = { ...row, ...publishedExtendedNutrients(row.publishedNutrition) };
      attribution = 'Panlasang Pinoy source recipe'; sourceUrl = row.sourceUrl;
    } else {
      const row = await prisma.mealLibrary.findFirst({ where: { id: chosen.id, status: 'APPROVED',
        flags: { none: { status: 'PENDING' } } }, select: { calories: true, proteinG: true, carbsG: true, fatG: true,
          sodiumMg: true, sugarG: true, fiberG: true, potassiumMg: true, phosphorusMg: true, saturatedFatG: true,
          nutritionServingDescription: true, nutritionEvidenceSource: true,
          sourceRawRecipeCandidate: { select: { sourceUrl: true } } } });
      if (!row) return null;
      values = row; serving = row.nutritionServingDescription || serving;
      attribution = `KAINARA library recipe · ${row.nutritionEvidenceSource}`;
      sourceUrl = row.sourceRawRecipeCandidate?.sourceUrl ?? null;
    }
    return {
      text: `${chosen.name}\n${serving}. These are recorded recipe values, not per 100 g or a personalized planned plate. Separately paired rice is excluded; rice already in the recipe remains included. Source: ${attribution}. Missing nutrients are not shown and do not mean zero. A library listing does not authorize this meal for your health profile.`,
      source: 'AI', creditsUsed: 1, links,
      facts: nutrients.flatMap(([key, label, unit]) => {
        const value = values[key];
        return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? [{ label, value: `${value.toFixed(1)} ${unit}` }] : [];
      }),
      references: sourceUrl?.startsWith('https://') ? [{ label: `${chosen.name} — recipe source`, href: sourceUrl }] : [],
    };
  }
}
