import type { ActivityLevel, DietaryPreference, Goal, RicePreference } from '@/types';

export interface TestMemberProfileOptions {
  age: number;
  biologicalSex: 'MALE' | 'FEMALE';
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  goal: Goal;
  activityLevel: ActivityLevel;
  dietaryPreference: DietaryPreference;
  ricePreference: RicePreference;
  foodCulture: string;
  shoppingDayOfWeek: number;
}
export const defaultTestMemberProfile = (): TestMemberProfileOptions => ({
  age: 26,
  biologicalSex: 'MALE',
  heightCm: 170,
  weightKg: 65,
  targetWeightKg: 65,
  goal: 'MAINTAIN',
  activityLevel: 'SEDENTARY',
  dietaryPreference: 'OMNIVORE',
  ricePreference: 'FLEXIBLE',
  foodCulture: 'Filipino',
  shoppingDayOfWeek: 6,
});
