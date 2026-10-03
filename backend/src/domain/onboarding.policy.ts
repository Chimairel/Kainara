export const CURRENT_TERMS_VERSION = '2026-09-27';
export const CURRENT_PRIVACY_VERSION = '2026-09-27';

export const ONBOARDING_PATHS = [
  '/onboarding/stats',
  '/onboarding/preferences',
  '/onboarding/conditions',
  '/onboarding/condition-details',
  '/onboarding/allergies',
  '/onboarding/allergy-details',
  '/onboarding/shopping-day',
  '/onboarding/tos',
] as const;

export type OnboardingPath = (typeof ONBOARDING_PATHS)[number];

export interface OnboardingSnapshot {
  onboardingDone: boolean;
  tosAccepted: boolean;
  acceptedTermsVersion?: string | null;
  acceptedPrivacyVersion?: string | null;
  profile?: {
    age?: number | null;
    biologicalSex?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    targetWeightKg?: number | null;
    goal?: string | null;
    activityLevel?: string | null;
    dietaryPreference?: string | null;
    ricePreference?: string | null;
    foodCulture?: string | null;
    shoppingDayGroup?: string | null;
    shoppingDayOfWeek?: number | null;
    safetyRevision?: number;
    otherConditions?: string | null;
    otherAllergies?: string | null;
  } | null;
  conditions: readonly string[];
  allergies: readonly string[];
  safetyEntries: readonly { domain: string }[];
  healthDetails?: readonly { area: string; state: string }[];
}

export interface OnboardingStatus {
  nextPath: OnboardingPath | '/nutrition-report';
  readyToComplete: boolean;
  missingFields: string[];
  currentTermsVersion: string;
  currentPrivacyVersion: string;
  acceptedCurrentConsent: boolean;
}

export function hasCurrentConsent(
  snapshot: Pick<
    OnboardingSnapshot,
    'onboardingDone' | 'tosAccepted' | 'acceptedTermsVersion' | 'acceptedPrivacyVersion'
  >
): boolean {
  if (!snapshot.tosAccepted) return false;

  const acceptedCurrentVersions =
    snapshot.acceptedTermsVersion === CURRENT_TERMS_VERSION &&
    snapshot.acceptedPrivacyVersion === CURRENT_PRIVACY_VERSION;

  // Existing onboarded accounts predate consent version storage. Preserve their
  // access while requiring every new completion to accept the current versions.
  const isGrandfatheredLegacyAccount =
    snapshot.onboardingDone && !snapshot.acceptedTermsVersion && !snapshot.acceptedPrivacyVersion;

  return acceptedCurrentVersions || isGrandfatheredLegacyAccount;
}

export function evaluateOnboardingStatus(snapshot: OnboardingSnapshot): OnboardingStatus {
  const profile = snapshot.profile;
  const missingFields: string[] = [];

  const statsComplete = Boolean(
    profile?.age &&
    profile.biologicalSex &&
    profile.heightCm &&
    profile.weightKg &&
    profile.targetWeightKg &&
    profile.goal &&
    profile.activityLevel
  );
  if (!statsComplete) {
    missingFields.push('age', 'biologicalSex', 'heightCm', 'weightKg', 'targetWeightKg', 'goal', 'activityLevel');
  }

  const preferencesComplete = Boolean(
    profile?.dietaryPreference && profile.ricePreference && profile.foodCulture?.trim()
  );
  if (!preferencesComplete) {
    missingFields.push('dietaryPreference', 'ricePreference', 'foodCulture');
  }

  // Legacy projections may contain NONE even when the person never answered.
  const conditionsComplete = snapshot.safetyEntries.some((entry) => entry.domain === 'CONDITION');
  if (!conditionsComplete) missingFields.push('healthConditions');

  const allergiesComplete = snapshot.safetyEntries.some((entry) => entry.domain === 'ALLERGY');
  if (!allergiesComplete) missingFields.push('allergies');

  // Existing completed members keep their profile/review workflow. New members
  // must save both declared-area forms before finishing onboarding.
  const details = snapshot.onboardingDone ? [] : (snapshot.healthDetails ?? []);
  const conditionDetailsComplete = !details.some((item) => item.area !== 'FOOD_ALLERGY' && item.state !== 'READY');
  const allergyDetailsComplete = !details.some((item) => item.area === 'FOOD_ALLERGY' && item.state !== 'READY');
  if (!conditionDetailsComplete) missingFields.push('conditionDetails');
  if (!allergyDetailsComplete) missingFields.push('allergyDetails');

  const shoppingDayComplete =
    (typeof profile?.shoppingDayOfWeek === 'number' &&
      profile.shoppingDayOfWeek >= 0 &&
      profile.shoppingDayOfWeek <= 6) ||
    Boolean(profile?.shoppingDayGroup);
  if (!shoppingDayComplete) missingFields.push('shoppingDayOfWeek');

  const acceptedCurrentConsent = hasCurrentConsent(snapshot);
  if (!acceptedCurrentConsent) missingFields.push('currentConsent');

  let nextPath: OnboardingStatus['nextPath'] = snapshot.onboardingDone ? '/nutrition-report' : '/onboarding/tos';
  if (!statsComplete) nextPath = '/onboarding/stats';
  else if (!preferencesComplete) nextPath = '/onboarding/preferences';
  else if (!conditionsComplete) nextPath = '/onboarding/conditions';
  else if (!conditionDetailsComplete) nextPath = '/onboarding/condition-details';
  else if (!allergiesComplete) nextPath = '/onboarding/allergies';
  else if (!allergyDetailsComplete) nextPath = '/onboarding/allergy-details';
  else if (!shoppingDayComplete) nextPath = '/onboarding/shopping-day';
  else if (!acceptedCurrentConsent) nextPath = '/onboarding/tos';

  return {
    nextPath,
    readyToComplete: missingFields.length === 0,
    missingFields: [...new Set(missingFields)],
    currentTermsVersion: CURRENT_TERMS_VERSION,
    currentPrivacyVersion: CURRENT_PRIVACY_VERSION,
    acceptedCurrentConsent,
  };
}
