export type QueueRow = {
  id: string;
  priority: number;
  status: string;
  queueReason: string | null;
  claimedRevision: number | null;
  messages: Array<{
    id: string;
    sender: 'USER' | 'NUTRITIONIST';
    itemRevision: number;
    content: string;
    createdAt: string;
  }>;
  claimStatus: { claimedByMe: boolean; claimedByOther: boolean; claimedByName: string | null };
  outsideMealLogItem: {
    id: string;
    name: string;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    calorieLow: number | null;
    calorieHigh: number | null;
    compatibilityStatus: string;
    nutritionStatus: string;
    includedInTotals: boolean;
    currentRevision: number;
    portionGrams?: number | null;
    source?: string;
    ingredients: string[] | null;
    mealLog: {
      mealName: string;
      mealType: string | null;
      loggedAt: string;
      estimationContext?: string | null;
      outsideImageMime?: string | null;
      user?: {
        name: string;
        healthConditions: { condition: string }[];
        allergies: { allergen: string }[];
        userProfile: {
          dietaryPreference: string | null;
          otherConditions: string | null;
          otherAllergies: string | null;
        } | null;
      };
    };
  };
};
export type ObservedSubmission = {
  id: string;
  sourceRevision: number;
  createdAt: string;
  sourceOutsideMealItem: {
    name: string;
    portionGrams: number | null;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    currentRevision: number;
    nutritionStatus: string;
    ingredients: unknown;
    mealLog: { mealType: string | null; estimationContext: string | null; status: string };
  } | null;
};
export type OutsideQueues = { rows: QueueRow[]; submissions: ObservedSubmission[] };
