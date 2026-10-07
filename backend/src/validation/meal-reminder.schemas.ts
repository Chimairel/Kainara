import { z } from 'zod';
import { isAllowedPushEndpoint, validMealTime, validTimeZone } from '@/domain/meal-reminder.policy';

export const mealReminderSettingsSchema = z
  .object({
    breakfastTime: z.string().refine(validMealTime, 'Choose a valid breakfast time.'),
    lunchTime: z.string().refine(validMealTime, 'Choose a valid lunch time.'),
    dinnerTime: z.string().refine(validMealTime, 'Choose a valid dinner time.'),
    timeZone: z.string().min(1).max(80).refine(validTimeZone, 'Choose a valid timezone.'),
    remindersEnabled: z.boolean(),
    prepareEnabled: z.boolean(),
    logEnabled: z.boolean(),
  })
  .strict();

export const pushSubscriptionSchema = z
  .object({
    endpoint: z.string().max(2048).refine(isAllowedPushEndpoint, 'Unsupported push notification provider.'),
    keys: z
      .object({
        p256dh: z
          .string()
          .regex(/^[A-Za-z0-9_-]{87}={0,1}$/)
          .refine((value) => {
            const bytes = Buffer.from(value, 'base64url');
            return bytes.length === 65 && bytes[0] === 4;
          }, 'Invalid push encryption key.'),
        auth: z
          .string()
          .regex(/^[A-Za-z0-9_-]{22}={0,2}$/)
          .refine((value) => Buffer.from(value, 'base64url').length === 16),
      })
      .strict(),
  })
  .strict();
export const pushEndpointSchema = z.object({ endpoint: z.string().max(2048) }).strict();
