import { getPlanHistory } from './meals-history.controller';
import { OutsideMealsController } from './outside-meals.controller';
import {
  replaceRetiredMeals,
  generateMealPlan,
  getGenerationStatus,
  retryMissingGeneration,
  ensureCurrentPlanRollover,
} from './meals/generation';
import { getCurrentPlan, getPlanWorkspace, getMealDetails } from './meals/plan-read';
import { getPlanCycles, acknowledgeIncompleteCycle, startShopping } from './meals/cycles';
import { updateMealStatus, updateMealLogNotes } from './meals/scheduled-logs';
import { getSwapOptions, executeSwap, getSwapPreview, getCompatibleLibrary } from './meals/swaps';
/** Stable route entry points; implementations are grouped by meal workflow. */
export class MealsController {
  static replaceRetiredMeals = replaceRetiredMeals;
  static generateMealPlan = generateMealPlan;
  static getGenerationStatus = getGenerationStatus;
  static retryMissingGeneration = retryMissingGeneration;
  static ensureCurrentPlanRollover = ensureCurrentPlanRollover;
  static getCurrentPlan = getCurrentPlan;
  static getPlanWorkspace = getPlanWorkspace;
  static getMealDetails = getMealDetails;
  static getPlanCycles = getPlanCycles;
  static acknowledgeIncompleteCycle = acknowledgeIncompleteCycle;
  static startShopping = startShopping;
  static updateMealStatus = updateMealStatus;
  static updateMealLogNotes = updateMealLogNotes;
  static getSwapOptions = getSwapOptions;
  static executeSwap = executeSwap;
  static getSwapPreview = getSwapPreview;
  static getCompatibleLibrary = getCompatibleLibrary;

  /**
   * GET /api/user/meals/history
   * Returns:
   *  - "Plan Meals" = MealLog records with source=SYSTEM_GENERATED and status=DONE
   *    (meals the user checked off as eaten from their plan)
   *  - "Outside Meals" = MealLog records with source=USER_LOGGED
   * Both normalized to the same shape and sorted by loggedAt descending.
   */
  static getPlanHistory = getPlanHistory;

  /**
   * POST /api/user/meals/log-outside
   * Logs an outside meal, performing pre-checks.
   */
  static logOutsideMeal = OutsideMealsController.logOutsideMeal;

  static getOutsideSuggestions = OutsideMealsController.getOutsideSuggestions;

  static editOutsideItem = OutsideMealsController.editOutsideItem;

  static voidOutsideLog = OutsideMealsController.voidOutsideLog;

  static requestOutsideItemReview = OutsideMealsController.requestOutsideItemReview;

  static replyToOutsideItemReview = OutsideMealsController.replyToOutsideItemReview;

  static consentToObservedMealReuse = OutsideMealsController.consentToObservedMealReuse;

  static withdrawObservedMealReuse = OutsideMealsController.withdrawObservedMealReuse;

  static attachOutsideImage = OutsideMealsController.attachOutsideImage;

  static getOutsideImage = OutsideMealsController.getOutsideImage;
}
