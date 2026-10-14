// Synthetic design fixtures only. No database, credentials, or live health records.
const day = '2026-10-14';
const stamp = `${day}T04:00:00.000Z`;
const verifier = {
  name: 'Sofia Reyes',
  prcLicenseNumber: 'DEMO-00001',
  prcLicenseExpiry: '2028-12-31',
  specialization: 'Community nutrition',
  university: 'Sample University',
  yearsOfExperience: 5,
  bio: 'Synthetic professional profile for the HTML design reference.',
};
const profile = (role) => ({
  id: 'design-member',
  name: role === 'ADMIN' ? 'Alex Santos' : role === 'NUTRITIONIST' ? 'Sofia Reyes' : 'Jamie Cruz',
  email: 'design@example.invalid',
  role,
  emailVerified: true,
  onboardingDone: true,
  tosAccepted: true,
  createdAt: '2026-08-01T04:00:00.000Z',
  image: null,
  authMethods: { password: true, google: false },
  healthConditions: [],
  allergies: [],
  safetyEntries: [],
  userProfile: {
    revision: 1,
    safetyRevision: 1,
    age: 28,
    biologicalSex: 'FEMALE',
    heightCm: 160,
    weightKg: 60,
    targetWeightKg: 57,
    goal: 'LOSE_WEIGHT',
    activityLevel: 'MODERATELY_ACTIVE',
    dietaryPreference: 'OMNIVORE',
    ricePreference: 'FLEXIBLE',
    ricePreferenceProvenance: 'USER_SELECTED',
    foodCulture: 'FILIPINO',
    dailyCalorieTarget: 1800,
    shoppingDayGroup: 'WEEKEND',
    shoppingDayOfWeek: 6,
    checkinStreak: 4,
    lastCheckinAt: stamp,
    planningGeographyLevel: 'NATIONAL',
    mealLocalityPreference: 'NATIONAL',
  },
  nutritionReport: {
    id: 'design-report',
    generatedAt: stamp,
    acknowledgedAt: stamp,
    isStale: false,
    profileRevision: 1,
  },
  onboardingStatus: {
    nextPath: null,
    readyToComplete: true,
    missingFields: [],
    acceptedCurrentConsent: true,
    currentTermsVersion: '2026-08-30',
    currentPrivacyVersion: '2026-08-30',
  },
});
const ingredients = [
  {
    id: 'ing-1',
    ingredientName: 'Chicken breast',
    name: 'Chicken breast',
    category: 'Meat & Fish',
    dataSource: 'FNRI',
    quantity: 150,
    unit: 'g',
    position: 0,
  },
  {
    id: 'ing-2',
    ingredientName: 'Rice',
    name: 'Rice',
    category: 'Grains & Pantry',
    dataSource: 'FNRI',
    quantity: 100,
    unit: 'g',
    position: 1,
  },
  {
    id: 'ing-3',
    ingredientName: 'Tomato',
    name: 'Tomato',
    category: 'Produce',
    dataSource: 'FNRI',
    quantity: 80,
    unit: 'g',
    position: 2,
  },
];
const recipeIngredients = [
  [
    ['Egg', 'Meat & Fish', 100],
    ['Rice', 'Grains & Pantry', 100],
    ['Tomato', 'Produce', 80],
  ],
  [
    ['Pork', 'Meat & Fish', 150],
    ['Rice', 'Grains & Pantry', 100],
    ['Carrots', 'Produce', 80],
  ],
  [
    ['Tofu', 'Grains & Pantry', 150],
    ['Rice', 'Grains & Pantry', 100],
    ['Pechay', 'Produce', 80],
  ],
  [
    ['Oats', 'Grains & Pantry', 50],
    ['Banana', 'Produce', 100],
    ['Peanut butter', 'Grains & Pantry', 15],
  ],
  [
    ['Pandesal', 'Grains & Pantry', 90],
    ['Egg', 'Meat & Fish', 100],
    ['Tomato', 'Produce', 80],
  ],
  [
    ['Beef', 'Meat & Fish', 150],
    ['Rice', 'Grains & Pantry', 100],
    ['Cabbage', 'Produce', 80],
  ],
].map((list, r) =>
  list.map(([ingredientName, category, quantity], position) => ({
    id: `recipe-${r}-ingredient-${position}`,
    ingredientName,
    name: ingredientName,
    category,
    quantity,
    unit: 'g',
    dataSource: 'FNRI',
    position,
  }))
);
const recipes = [
  ['Scrambled egg and rice plate', 'BREAKFAST', 420, 20, 55, 13, 'scrambled-egg-rice.jpg'],
  ['Pork rice bowl with carrots', 'LUNCH', 560, 38, 62, 18, 'pork-bowl.jpg'],
  ['Tofu rice bowl', 'DINNER', 450, 35, 46, 14, 'tofu-bowl.jpg'],
  ['Banana peanut butter oatmeal', 'SNACK', 240, 8, 38, 7, 'oatmeal.jpg'],
  ['Pandesal, egg and tomato breakfast', 'BREAKFAST', 390, 19, 48, 14, 'pandesal.jpg'],
  ['Beef rice bowl with cabbage', 'LUNCH', 540, 32, 60, 19, 'beef-bowl.jpg'],
].map(([mealName, mealType, calories, proteinG, carbsG, fatG, photo], i) => ({
  id: `recipe-${i}`,
  mealName,
  mealType,
  mealTypes: [mealType],
  calories,
  proteinG,
  carbsG,
  fatG,
  description: 'A balanced meal prepared with familiar, locally available ingredients.',
  status: 'APPROVED',
  baseVerification:'VERIFIED',
  ingredients: recipeIngredients[i],
  verifier,
  verifiedBy: verifier.name,
  prcLicenseNumber: verifier.prcLicenseNumber,
  isFavorite: i === 1,
  riceRole: i === 3 ? 'STANDALONE' : 'INCLUDES_RICE',
  riceRoleReviewStatus: 'REVIEWED',
  includedRiceG: 100,
  image: { url: `/meals/${photo}`, altText: mealName, kind: 'REPRESENTATIVE', attribution: {} },
  usageCount: 12 + i,
  addedAt: stamp,
  suitableConditions: [],
  allergenFree: [],
  dietaryTags: ['OMNIVORE'],
  flags: [],
  safetyEvidenceStatus: 'COMPLETE',
  safetyEvidenceRevision: 1,
  certifiedEvidenceRevision: 1,
  conditionDeclarationState: 'REVIEWED_NONE_DECLARED',
  allergenDeclarationState: 'REVIEWED_NONE_DECLARED',
  crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
  verifiedByNutritionistId: 'design-rnd',
  verifiedByNutritionist: { id: 'design-rnd', userId: 'design-rnd', ...verifier, user: { name: verifier.name } },
  explanation: {
    source: 'VERIFIED_LIBRARY',
    reviewState: 'NUTRITIONIST_VERIFIED',
    nutritionEvidence: 'ALL_FNRI',
    calorieFit: 'WITHIN_TARGET',
    bullets: ['Fits your daily calorie target.', 'Ingredients matched to food composition records.'],
  },
}));
const meals = Array.from({ length: 7 }, (_, d) =>
  recipes.slice(0, 4).map((r, i) => ({
    ...r,
    id: `meal-${d}-${i}`,
    libraryMealId: r.id,
    planGroupId: 'design-plan',
    userId: 'design-member',
    planType: 'WEEKLY',
    cycleScope: 'CURRENT',
    aiConfidenceFlag: 'SAFE',
    scheduledDate: `2026-10-${14 + d}T04:00:00.000Z`,
    createdAt: stamp,
    reviewedAt: stamp,
    mealLogs:
      d === 0 && i < 2
        ? [
            {
              id: `log-${i}`,
              status: 'DONE',
              loggedAt: stamp,
              calories: r.calories,
              proteinG: r.proteinG,
              carbsG: r.carbsG,
              fatG: r.fatG,
            },
          ]
        : [],
  }))
).flat();
const groceryItems = [
  ['Tomato', 'Produce', 560, 'g'],
  ['Carrots', 'Produce', 420, 'g'],
  ['Bananas', 'Produce', 7, 'pcs'],
  ['Pechay', 'Produce', 350, 'g'],
  ['Chicken breast', 'Meat & Fish', 1050, 'g'],
  ['Eggs', 'Meat & Fish', 14, 'pcs'],
  ['Rice', 'Grains & Pantry', 1400, 'g'],
  ['Oats', 'Grains & Pantry', 350, 'g'],
  ['Soy sauce', 'Grains & Pantry', 70, 'ml'],
].map(([ingredientName, category, quantity, unit], i) => ({
  id: `grocery-${i}`,
  ingredientName,
  category,
  quantity,
  unit,
  isChecked: i < 2,
  purchasedQuantity: i < 2 ? quantity : 0,
  sourceMealCount: 7,
  isPantryStaple: false,
}));
const groceryList = { id: 'design-grocery', weekLabel: 'October 14–20, 2026', generatedAt: stamp, groceryItems };
const cycle = {
  id: 'design-cycle',
  startDate: stamp,
  endDate: '2026-10-20T15:59:59Z',
  status: 'ACTIVE',
  deadlineOutcome: 'COMPLETE',
  incompleteAcknowledgedAt: null,
  shoppingStartedAt: stamp,
};
const projection = {
  scope: 'CURRENT',
  cycle,
  groceryList,
  coverage: { clearedSlotCount: 28, expectedSlotCount: 28, unresolvedSlotCount: 0 },
  actionability: {
    canCheckItems: true,
    canExportPdf: true,
    isFinal: true,
    isIncomplete: false,
    quantitiesMayIncrease: false,
    requiresIncompleteAcknowledgment: false,
    message: 'Your reviewed meals are ready to shop.',
  },
};
const queue = meals.slice(0, 3).map((m, i) => ({
  ...m,
  user: { id: 'design-member', name: 'Jamie Cruz' },
  status: 'PENDING_REVIEW',
  aiConfidenceFlag: i === 0 ? 'NEEDS_REVIEW' : 'SAFE',
  claimStatus: { claimedByMe: false, claimedByOther: false, claimedByName: null },
  highRiskReviewRequired: false,
  reviewApprovalCount: 0,
  requiresIndependentSecondReview: false,
  intendedCycle: cycle,
  shoppingDeadlineAt: stamp,
  cookDeadlineAt: stamp,
  assuranceTier: 'BASE',
  reviewStage: 'PRIMARY',
  remainingReviewers: 1,
  deterministicFindings: { confidence: 'SAFE', estimatedIngredientCount: 0 },
  sourceProvenance: 'AI_FROM_SCRATCH',
  fallbackAvailable: true,
  rankingReasonCodes: [],
  deadlinePriorityReason: 'Upcoming shopping cycle',
  coalescedDependentCount: 1,
}));
const analytics = {
  totalUsers: 248,
  totalNutritionists: 12,
  verifiedNutritionists: 10,
  activeMealPlans: 186,
  pendingReviews: 18,
  libraryCount: 124,
  totalMealLogs: 1620,
  totalFoodItems: 1524,
  totalAliases: 86,
  overdueReviews: 2,
  activeReviewClaims: 4,
  expiredVerifiedNutritionists: 1,
  completeLibraryEvidence: 118,
  incompleteLibraryEvidence: 4,
  staleLibraryEvidence: 2,
  failedGenerationJobs24h: 1,
  stuckGenerationJobs: 0,
  aiSuccess24h: 42,
  aiFailures24h: 1,
  adaptationReviews30d: 7,
  pendingPlansStartingSoon: 3,
  activeConditionClearances: 24,
  activeClearancesByCondition: [],
  rawRecipeCandidates: 32,
  aiUsageByOperation30d: [],
  planSelectionsByProvenance30d: [
    { provenance: 'CERTIFIED_LIBRARY', count: 98 },
    { provenance: 'AI_FROM_SCRATCH', count: 26 },
  ],
  geminiFromScratchSelectionRate30d: 21,
  geminiPlanningInvocationsPer100Selections30d: 8,
};
const report = {
  id: 'design-report',
  version: 1,
  profileRevision: 1,
  generatedAt: stamp,
  acknowledgedAt: stamp,
  isStale: false,
  basedOnConditions: [],
  basedOnAllergies: [],
  generalSummary:
    'An illustrative nutrition report based on this synthetic profile. Build balanced meals with vegetables, lean protein and familiar grains, and keep a consistent meal and shopping schedule.',
  calorieTarget: 1800,
  dailyCalorieTarget: 1800,
  bmr: 1289,
  tdee: 1998,
  recommendedCalories: 1800,
  macroTargets: { proteinG: 90, carbsG: 225, fatG: 60 },
  foodsToAvoid: ['No restriction declared in this sample profile.'],
  foodsToLimit: ['Sugary drinks', 'Highly processed snacks'],
  foodsRecommended: ['Vegetables', 'Lean protein', 'Whole grains'],
  drinksGuidance: ['Drink water regularly throughout the day.'],
  warnings: [],
  disclaimer: 'Synthetic content for interface design only.',
};
function response(endpoint, role) {
  const p = endpoint.split('?')[0];
  if(p==='/notifications')return {notifications:[],unreadCount:0};
  if(p==='/user/clinical-profile-review/status')return {required:false,approved:true,declarationRequired:false,detailsRequest:null};
  if(p==='/user/clinical-evidence')return {safetyRevision:1,availableAreas:[],contexts:[],requirements:[],clarifications:{enabled:false,forms:[]},profileProposals:{enabled:false,proposals:[]}};
  if(p==='/nutritionist/review-work-counts')return {case:3,meal:6,profile:0,audit:0};
  if(p==='/nutritionist/credential-status')return {eligible:true,reason:null,expiryDate:'2028-12-31',isVerified:true};
  if(p==='/nutritionist/license-updates' || p==='/admin/license-updates')return {rows:[],pending:0,total:0,page:1,totalPages:1};
  if(p==='/user/meals/verified-recipes/summary')return {total:6,restrictedProfile:false};
  if(p==='/user/meals/history/count')return {total:6};
  if(p==='/user/meals/verified-recipes')return {items:recipes.map(r=>({...r,name:r.mealName,sourceName:'Verified meal library',sourceUrl:null,imageUrl:r.image.url,planningReady:true})),total:6,page:1,pageCount:1,restrictedProfile:false};
  if(p==='/user/meals/cycles')return {current:cycle,upcoming:null};
  if (p === '/user/profile') return profile(role);
  if (p === '/user/meals/current' || p === '/user/meals/workspace') return meals;
  if (p === '/user/meals/meal-0-0') return meals[0];
  if (p === '/user/onboarding/planning-locations')
    return {
      regions: ['National Capital Region (NCR)', 'Central Visayas (Region VII)'],
      provinceHucs: [{ name: 'Cebu City', regionName: 'Central Visayas (Region VII)' }],
    };
  if (p === '/user/onboarding/safety-catalogue') {
    const item = (code, displayName, domain) => ({
      code,
      displayName,
      aliases: [],
      searchTerms: [],
      domains: [domain],
      supportState: 'SUPPORTED',
      policyReference: 'Design fixture',
    });
    return {
      conditions: [
        item('NONE', 'No diagnosed condition', 'CONDITION'),
        item('TYPE_2_DIABETES', 'Type 2 diabetes', 'CONDITION'),
        item('HYPERTENSION', 'Hypertension', 'CONDITION'),
        item('KIDNEY_DISEASE', 'Kidney disease', 'CONDITION'),
        item('HEART_DISEASE', 'Heart disease', 'CONDITION'),
      ],
      foodSafety: [
        item('NONE', 'No food restriction', 'ALLERGY'),
        item('PEANUT', 'Peanuts', 'ALLERGY'),
        item('SHELLFISH', 'Shellfish', 'ALLERGY'),
        item('EGG', 'Eggs', 'ALLERGY'),
        item('MILK', 'Milk', 'ALLERGY'),
        item('NONE', 'No food restriction', 'INTOLERANCE'),
        item('LACTOSE', 'Lactose', 'INTOLERANCE'),
        item('NONE', 'No food restriction', 'AVOIDED_INGREDIENT'),
        item('PORK', 'Pork', 'AVOIDED_INGREDIENT'),
      ],
    };
  }
  if (p === '/user/meals/history')
    return endpoint.includes('USER_LOGGED')
      ? []
      : meals.slice(0, 6).map((m) => ({
          ...m,
          source: 'SYSTEM_GENERATED',
          status: 'DONE',
          loggedAt: stamp,
          nutritionCompleteness: 'COMPLETE',
          provisionalCalories: 0,
        }));
  if (p.includes('/meals/library') || p.includes('/meals/compatible-library') || p.includes('swap-options'))
    return recipes;
  if (p === '/user/grocery/current') return groceryList;
  if (p === '/user/grocery/workspace') return { current: projection, upcoming: null };
  if (p === '/user/water/today') return { totalMl: 1250 };
  if (p === '/user/checkin/status') return { isDue: false, streak: 4, lastCheckinAt: stamp };
  if (p === '/user/progress/history')
    return {
      weightLogs: Array.from({ length: 8 }, (_, i) => ({
        id: `weight-${i}`,
        weightKg: 63 - i * 0.4,
        note: null,
        loggedAt: `2026-0${i < 4 ? 8 : 9}-${String(4 + i * 3).padStart(2, '0')}T04:00:00Z`,
      })),
      dailyNutritionLogs: Array.from({ length: 14 }, (_, i) => ({
        id: `daily-${i}`,
        totalCalories: 1660 + (i % 4) * 70,
        totalProteinG: 85,
        totalCarbsG: 210,
        totalFatG: 54,
        targetCalories: 1800,
        adherencePct: 92 + (i % 6),
        logDate: `2026-10-${String(i + 1).padStart(2, '0')}T04:00:00Z`,
      })),
    };
  if (p === '/user/nutrition-report/history')
    return [{ id: report.id, version: 1, generatedAt: stamp, content: report }];
  if (p.includes('/nutrition-report')) return report;
  if (p === '/nutritionist/queue') return queue;
  if (p === '/nutritionist/approved')
    return meals.slice(0, 4).map((m) => ({
      ...m,
      user: { name: 'Jamie Cruz' },
      nutritionistNote: 'Reviewed sample meal.',
      approvedAt: stamp,
    }));
  if (p.startsWith('/nutritionist/queue/'))
    return {
      mealPlan: queue[0],
      user: {
        name: 'Jamie Cruz',
        age: 28,
        sex: 'FEMALE',
        goal: 'LOSE_WEIGHT',
        dailyCalorieTarget: 1800,
        dietaryPreference: 'OMNIVORE',
        ricePreference: 'FLEXIBLE',
        conditions: [],
        allergies: [],
        safetyEntries: [],
      },
      ingredients: queue[0].ingredients.map((i) => ({
        name: i.ingredientName,
        source: 'FNRI',
        quantity: i.quantity,
        unit: i.unit,
      })),
      warnings: [],
      claimStatus: queue[0].claimStatus,
      highRiskReviewRequired: false,
      reviewApprovalCount: 0,
      requiresIndependentSecondReview: false,
    };
  if (p === '/nutritionist/library' || p === '/admin/library' || p === '/admin/meals')
    return { meals: recipes, total: recipes.length, limit: 12, page: 1 };
  if (p.includes('library-coverage')) return { certifiedMeals: 124, requiredPerSlot: 3, profiles: [] };
  if (p === '/nutritionist/profile') return { id: 'design-rnd', ...verifier, isVerified: true, totalVerified: 124 };
  if (p === '/admin/analytics') return {...analytics,generatedAt:stamp,approvedUpcomingMealSlots:28,usdaFoodItems:560,planningAiOperations30d:72};
  if (p === '/admin/data')
    return {
      summary: {
        foodItems: 1524,
        foodAliases: 86,
        mealLibrary: 124,
        completeMealLibrary: 118,
        priceSources: 0,
        pricePublications: 0,
        priceObservations: 0,
        consumptionStats: 360,
        dataSources: 1,
        activeReleases: 0,
      },
      sources: [
        {
          id: 'design-source',
          code: 'FNRI',
          name: 'Philippine food composition reference',
          agencyName: 'DOST-FNRI',
          domain: 'FOOD_COMPOSITION',
          homepageUrl: 'https://fnri.dost.gov.ph/',
          attributionText:
            'Illustrative catalogue reference; existing repository sources retain their original attributions.',
          isEnabled: true,
        },
      ],
      releases: [],
      consumptionCsvTemplate: 'foodNameRaw,regionName,meanIntakeG',
    };
  if (p === '/admin/data/foods')
    return {
      foods: [
        {
          id: 'food-1',
          name: 'Rice, well-milled, cooked',
          calories: 130,
          proteinG: 2.7,
          carbsG: 28,
          fatG: 0.3,
          aliases: [{ id: 'alias-1', alias: 'Cooked white rice' }],
        },
        {
          id: 'food-2',
          name: 'Chicken breast, cooked',
          calories: 165,
          proteinG: 31,
          carbsG: 0,
          fatG: 3.6,
          aliases: [],
        },
        { id: 'food-3', name: 'Banana, ripe', calories: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3, aliases: [] },
      ],
      total: 3,
      page: 1,
      limit: 12,
      totalPages: 1,
    };
  if (p === '/admin/users')
    return {
      users: [
        profile('USER'),
        { ...profile('USER'), id: 'design-member-2', name: 'Morgan Ramos', email: 'morgan@example.invalid' },
        { ...profile('NUTRITIONIST'), id: 'design-rnd' },
      ].map((u) => ({ ...u, isActive: true, isSuspended: false, _count: { mealPlans: 28, mealLogs: 12 } })),
      total: 3,
      totalPages: 1,
      page: 1,
    };
  if (p === '/admin/nutritionists')
    return [
      {
        id: 'design-rnd',
        ...verifier,
        isVerified: true,
        verifiedAt: stamp,
        createdAt: stamp,
        user: { name: verifier.name, email: 'sofia@example.invalid', createdAt: stamp },
        _count: { mealPlans: 124 },
      },
    ];
  if (p === '/admin/nutritionist-applications')
    return [
      {
        id: 'design-application',
        referenceCode: 'DEMO-2026-001',
        status: 'UNDER_REVIEW',
        fullName: 'Taylor Rivera',
        email: 'taylor@example.invalid',
        phoneNumber: 'Sample contact',
        prcLicenseNumber: 'DEMO-00002',
        prcLicenseExpiry: '2028-12-31',
        specialization: 'Community nutrition',
        yearsOfExperience: 3,
        university: 'Sample University',
        professionalBio: 'Synthetic application for the design reference.',
        availableCallSlots: ['Weekdays, 9 AM–12 PM'],
        createdAt: stamp,
      },
    ];
  if (p.includes('notifications')) return [];
  if (p === '/public/website') return null;
  if (p.includes('membership')) return { tier: 'FREE', status: 'ACTIVE', plan: 'FREE', membership: null };
  return [];
}
module.exports = { response, meals, recipes, cycle, stamp };
