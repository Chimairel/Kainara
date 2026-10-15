import prisma from '@/lib/prisma';
import { getManilaDateKey } from '@/domain/meal-plan-cycle.policy';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';
import { normalizeAssistantQuestion } from '@/domain/member-assistant-information';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { GroceryService } from './grocery.service';
import type { AssistantReply } from './member-assistant.service';

/** Read-only personalized answers. The same cycle clearance used by Meals/Groceries applies. */
export class MemberAssistantPlanService {
  static async currentMeals(userId: string, message: string, now = new Date()): Promise<AssistantReply> {
    const { cycle, clearedIds } = await MealPlanCycleService.getCurrentCycleWithClearance(userId, now);
    const start = getStartOfManilaBusinessDay(now);
    const text = normalizeAssistantQuestion(message);
    const types = (['BREAKFAST', 'LUNCH', 'DINNER'] as const).filter(type => text.split(' ').includes(type.toLowerCase()));
    const rows = cycle ? await prisma.mealPlan.findMany({
      where: { userId, planGroupId: cycle.id, scheduledDate: { gte: start, lt: new Date(+start + 86400000) },
        status: { not: 'CANCELLED' }, supersededByMealPlanId: null, ...(types.length === 1 ? { mealType: types[0] } : {}) },
      select: { id: true, mealName: true, mealType: true, status: true },
      orderBy: [{ mealType: 'asc' }, { id: 'asc' }], take: 12,
    }) : [];
    const ready = new Set(clearedIds);
    return {
      source: 'SYSTEM', creditsUsed: 0,
      text: rows.length
        ? `Your scheduled ${types.length === 1 ? types[0].toLowerCase() : 'meals'} for today (${getManilaDateKey(now)}, Asia/Manila):\n${rows.map(meal => `• ${meal.mealType.toLowerCase()}: ${meal.mealName} — ${ready.has(meal.id) ? 'cleared for the plan' : 'not cleared; check its current notice'}`).join('\n')}\nThese are planned meals, not food recorded as eaten. Open Meal plan for servings, questions and available actions.`
        : 'No matching scheduled meal is recorded for today (Asia/Manila) in your current cycle. It may still be preparing or unavailable. Check Meal plan for the current status; this is not an instruction to skip eating.',
      links: [{ label: 'Meal plan', href: '/meals' }],
    };
  }

  static async groceries(userId: string, now = new Date()): Promise<AssistantReply> {
    const projection = await GroceryService.getTodayIngredients(userId, now);
    const date = getManilaDateKey(now);
    const day = projection?.days.find(day => day.date === date);
    const items = day?.items ?? [];
    return {
      source: 'SYSTEM', creditsUsed: 0,
      text: items.length
        ? `Ingredients for today’s ${day!.clearedMealCount} cleared planned meal${day!.clearedMealCount === 1 ? '' : 's'} (${date}, Asia/Manila), including recorded rice:\n${items.slice(0, 20).map(item => `• ${item.ingredientName}: ${item.quantity === null ? 'amount not recorded' : `${item.quantity.toFixed(1)} ${item.unit ?? ''}`}`).join('\n')}${items.length > 20 ? '\nMore ingredients are listed in Groceries.' : ''}\nThese are recipe requirements, not a remaining-to-buy calculation. Check your pantry and cycle checklist before buying. Pending meals are excluded; the day’s list can change after review or swaps.`
        : 'No ingredient requirements are available for today’s cleared meals. Your cycle or checklist may still be preparing or held for review. This does not mean you need no food. Open Groceries and Meal plan to check their status.',
      links: [{ label: 'Groceries', href: `/grocery?day=${date}` }, { label: 'Meal plan', href: '/meals' }],
    };
  }
}
