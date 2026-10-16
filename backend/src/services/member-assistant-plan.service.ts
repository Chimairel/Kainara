import prisma from '@/lib/prisma';
import { getManilaDateKey } from '@/domain/meal-plan-cycle.policy';
import { getStartOfManilaBusinessDay, isMealPlanScheduleLoggable } from '@/domain/meal-actionability.policy';
import { normalizeAssistantQuestion } from '@/domain/member-assistant-information';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { GroceryService } from './grocery.service';
import type { AssistantReply } from './member-assistant.service';
import { PlanningReadinessService } from './planning-readiness.service';
import { NutritionReportService } from './nutrition-report.service';

export function assistantMealStatusTarget(message: string): string | null {
  const text = normalizeAssistantQuestion(message);
  const match = text.match(/\b(?:(?:can|may|could) i (?:eat|have)|is it safe (?:for me )?to eat) (.+?)(?:\s+(?:if|when|with|despite|because|on|today|tomorrow|yesterday)\b|$)/)
    ?? text.match(/\b(?:is|are) (.+?) (?:safe|approved|cleared) for me\b/)
    ?? text.match(/\b(?:pwede|puwede) (?:ba )?(?:akong |ako )?(?:kumain|kainin) (?:ng |ang )?(.+?)(?:\s+(?:kung|kapag|kahit|may|na may|ngayon|bukas|kahapon)\b|$)/)
    ?? text.match(/\b(?:pwede|puwede) ba (?:ang|(?:sa akin|sakin) ang) (.+?)(?:\s+(?:kung|kapag|kahit|may|ngayon|bukas|kahapon)\b|$)/);
  const target = match?.[1]?.replace(/^(?:the|a|an) /, '').replace(/\s+(?:on |sa )?\d{4} \d{2} \d{2}$/, '').trim();
  return target && target.length <= 80 && !/^(?:this|that|it|this meal|that meal|my meal|meal|meals|food|ito|iyan|yan|ulam|pagkain)$/.test(target)
    ? target : null;
}

/** Informational answers using Meals/Groceries' existing lifecycle and clearance checks. No chat mutation commands. */
export class MemberAssistantPlanService {
  static async planningStatus(userId: string, now = new Date()): Promise<AssistantReply> {
    const [readiness, report] = await Promise.all([
      PlanningReadinessService.getForUser(userId), NutritionReportService.getReport(userId),
    ]);
    const guidance = !report ? 'No nutrition guidance is recorded. Open Nutrition guidance to follow the available setup action.'
      : `Latest guidance: version ${report.version}, ${report.acknowledgedAt ? 'acknowledged' : 'not acknowledged'}.${report.isStale ? ' It is marked outdated.' : ''} Active planning version: ${report.planningContext?.activeVersion ?? 'none recorded'}.${report.planningContext?.pendingChanges ? ' Saved profile changes differ from the active planning context.' : ''}`;
    const actionPath = ['/meals', '/membership', '/profile/clinical-evidence'].includes(readiness.actionPath) ? readiness.actionPath : '/meals';
    return { source: 'SYSTEM', creditsUsed: 0,
      text: `Planning status checked ${getManilaDateKey(now)} (Asia/Manila).\n${readiness.title}\n${readiness.message}\n\n${guidance}\nThese are planning notices, not approval of every meal. Profile questions are in Health details; meal questions and exact serving notices are in Meal plan. Acknowledging a report does not clear a pending meal. I have not applied a report, answered a form or changed your plan.`,
      links: [{ label: 'Next planning step', href: actionPath }, { label: 'Nutrition guidance', href: '/profile/nutrition-report' },
        { label: 'Meal plan', href: '/meals' }, { label: 'Health details', href: '/profile/clinical-evidence' }, { label: 'Help', href: '/help' }],
    };
  }

  static async mealStatus(userId: string, message: string, now = new Date()): Promise<AssistantReply> {
    const target = assistantMealStatusTarget(message);
    const links = [{ label: 'Meal plan', href: '/meals' }, { label: 'Health & goals', href: '/profile/health' },
      { label: 'Health details', href: '/profile/clinical-evidence' }];
    const boundary = 'A dish name, recipe verification or nutrition table alone cannot establish personal suitability for a condition or allergy. This reports saved plan status only, not medical clearance or a guarantee about food you prepare. Keep your saved conditions/allergies accurate; a condition typed here does not update or verify your profile.';
    if (!target) return { source: 'SYSTEM', creditsUsed: 0,
      text: `Which exact scheduled meal do you mean? Use its full name from Meal plan, for example “can I eat Beef Ribs Sinigang?” Include a YYYY-MM-DD date if there are several entries. For a different cycle, open that entry in Meal plan. ${boundary}`, links };
    const text = normalizeAssistantQuestion(message);
    const dateMatch = message.match(/\b\d{4}-\d{2}-\d{2}\b/);
    const offset = /\b(tomorrow|bukas)\b/.test(text) ? 1 : /\b(yesterday|kahapon)\b/.test(text) ? -1 : 0;
    const date = dateMatch ? new Date(`${dateMatch[0]}T00:00:00+08:00`)
      : /\b(today|tomorrow|yesterday|ngayon|bukas|kahapon)\b/.test(text) ? new Date(+getStartOfManilaBusinessDay(now) + offset * 86400000) : null;
    if (dateMatch && (!date || !Number.isFinite(+date) || getManilaDateKey(date) !== dateMatch[0])) return {
      source: 'SYSTEM', creditsUsed: 0, text: 'Use a valid YYYY-MM-DD date from Meal plan. I have not selected a meal or checked its clearance.', links,
    };
    // Reuse Meals' existing clearance/lifecycle checks; never derive approval from AI or a status label alone.
    const { cycle, clearedIds } = await MealPlanCycleService.getCurrentCycleWithClearance(userId, now);
    const rows = cycle ? await prisma.mealPlan.findMany({ where: {
      userId, planGroupId: cycle.id, supersededByMealPlanId: null, status: { not: 'CANCELLED' },
      mealName: { contains: target, mode: 'insensitive' },
      ...(date ? { scheduledDate: { gte: date, lt: new Date(+date + 86400000) } } : {}),
    }, select: { id: true, mealName: true, mealType: true, scheduledDate: true, status: true, requiresSafetyRevalidation: true },
    orderBy: [{ scheduledDate: 'asc' }, { id: 'asc' }], take: 6 }) : [];
    const matches = rows.filter(row => ` ${normalizeAssistantQuestion(row.mealName)} `.includes(` ${target} `));
    if (matches.length !== 1 || rows.length === 6) return { source: 'SYSTEM', creditsUsed: 0,
      text: `${matches.length ? `Several scheduled records may match “${target}” in your current cycle:\n${matches.slice(0, 5).map(row => `• ${row.mealName} · ${getManilaDateKey(row.scheduledDate)} · ${row.mealType.toLowerCase()}`).join('\n')}\nOpen the exact dated entry in Meal plan; I have not selected one.`
        : `I could not identify one scheduled “${target}” in your current cycle. It may be a different variant, date or outside food; this does not mean the dish is safe or unsafe. Open Meal plan to select an exact entry.`}\n${boundary}`, links };
    const meal = matches[0];
    const cleared = clearedIds.includes(meal.id) && !meal.requiresSafetyRevalidation && meal.status === 'APPROVED';
    return { source: 'SYSTEM', creditsUsed: 0,
      text: `${meal.mealName} · ${getManilaDateKey(meal.scheduledDate)} · ${meal.mealType.toLowerCase()}\n${cleared
        ? 'The existing plan checks currently mark this recorded meal/serving as cleared for the saved planning context.'
        : 'This recorded meal is not currently cleared by the plan checks. Do not treat it as an approved recommendation. Read its current notice and resolve any required review/question in the existing workflow.'}\n${isMealPlanScheduleLoggable(meal.scheduledDate, now)
        ? 'The date is within the logging window; other action checks still apply.' : 'The date is outside the current logging window; future meals cannot be marked eaten early and past planned meals have a seven-day window.'}\n${boundary}\nChanging ingredients, portions or rice can change the reviewed context. Chat has not marked this meal eaten or granted approval.`, links };
  }

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
