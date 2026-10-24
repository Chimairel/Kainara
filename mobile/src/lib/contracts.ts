export type Envelope<T> = {
  success: boolean;
  data: T;
  meta?: PlanMeta;
  error?: string;
  errorCode?: string;
  retryAt?: string;
};
export type Tokens = { accessToken: string; refreshToken: string };
export type MemberProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  onboardingDone: boolean;
  tosAccepted: boolean;
  reportAcknowledged?: boolean;
  onboardingStatus?: {
    nextPath: string;
    readyToComplete: boolean;
    missingFields: string[];
    acceptedCurrentConsent: boolean;
    currentTermsVersion: string;
    currentPrivacyVersion: string;
  };
  userProfile: {
    revision?: number;
    age?: number;
    biologicalSex?: string;
    heightCm?: number;
    weightKg?: number;
    targetWeightKg?: number;
    goal?: string;
    activityLevel?: string;
    dailyCalorieTarget?: number;
    dietaryPreference?: string;
    ricePreference?: string;
    foodCulture?: string;
    shoppingDayOfWeek?: number;
  } | null;
  healthConditions: string[];
  allergies: string[];
  nutritionReport: { id: string; profileRevision?: number; acknowledgedAt?: string; isStale?: boolean } | null;
};
export type Meal = {
  id: string;
  mealName: string;
  mealType: string;
  scheduledDate: string;
  description?: string;
  status: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  image?: { url: string; altText?: string; attribution?: { creator?: string; sourcePageUrl?: string } } | null;
  mealLogs?: { status: string }[];
  ricePortion?: string | null;
  verifier?: { name: string; reviewScope?: string } | null;
  explanation?: { bullets: string[]; limitation?: string; reviewState?: string };
  ingredients?: { id: string; ingredientName: string }[];
  cookingLink?: { url: string } | null;
};
export type PlanMeta = {
  cycles?: {
    current?: { planType?: string; startDate: string; endDate: string } | null;
    upcoming?: { startDate: string; endDate: string } | null;
  };
  planSnapshot?: { dailyCalorieTarget?: number; dailyMacroTargets?: Record<string, NutritionTotals> } | null;
  total?: number;
  nextCursor?: string | null;
  cycle?: { startDate: string; endDate: string; id: string } | null;
  pendingReview?: { meals?: Meal[]; count?: number };
  awaitingGenerationCount?: number;
  generationStatus?: string | { current?: string; upcoming?: string };
};
export type NutritionTotals = { calories: number; proteinG: number; carbsG: number; fatG: number };
export type Report = {
  id: string;
  version: number;
  isStale: boolean;
  acknowledgedAt?: string | null;
  generalSummary: string;
  profileSummary?: { label: string; value: string }[];
  planningTargets?: { calories: number; proteinG: number; carbsG: number; fatG: number; explanation: string };
  calorieCalculation?: {
    rawBmr: number;
    rawTdee: number;
    dailyCalorieTarget: number;
    activityMultiplier: number;
    goalAdjustment: number;
    sexTerm: number;
    sourceTitle: string;
    sourceUrl: string;
    inputs: { age: number; weightKg: number; heightCm: number; biologicalSex: string };
  };
  foodGuidance?: {
    avoid: Guidance[];
    limit: Guidance[];
    choose: Guidance[];
    discuss: Guidance[];
    sources: { code: string; title: string; url: string }[];
  };
  referenceItems?: { heading: string; value: string; explanation: string; sourceUrl?: string }[];
};
type Guidance = { name: string; reason: string; tip: string; sourceCode: string };
export type GroceryItem = {
  id: string;
  ingredientName: string;
  category?: string;
  quantity?: number;
  unit?: string;
  isChecked: boolean;
};
export type GroceryList = { id: string; groceryItems: GroceryItem[] };
export type Progress = {
  weightLogs: { id: string; weightKg: number; loggedAt: string }[];
  dailyNutritionLogs: { id: string; logDate: string; totalCalories?: number; consumedCalories?: number }[];
  waterHistory?: {
    days: {
      date: string;
      totalMl: number;
      entryCount?: number;
      entries?: { id: string; amountMl: number; loggedAt: string }[];
    }[];
  };
};
export type HistoryEntry = {
  id: string;
  status?: string;
  nutritionCompleteness?: string;
  provisionalCalories?: number;
  mealName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  loggedAt: string;
  source?: string;
  items?: { id: string; name: string; review?: { status?: string; feedback?: string } }[];
};
export type Allowance = { remaining: number; cap: number; resetsAt: string; nextAiRequestAt?: string | null };
export type Reply = {
  text: string;
  source: string;
  creditsUsed: number;
  links?: { label: string; href: string }[];
  references?: { label: string; href: string }[];
  facts?: { label: string; value: string }[];
};
export type ChatInput = {
  requestKey: string;
  message: string;
  allowAi: boolean;
  context: { role: 'user' | 'assistant'; content: string }[];
  action?: 'TODAY' | 'GUIDANCE' | 'FIND_MEAL' | 'VIEW_PLAN';
};
export type ChatResult = { allowance: Allowance } & (
  { confirmationRequired: true; cost: number; requestKey: string } | { confirmationRequired: false; reply: Reply }
);
