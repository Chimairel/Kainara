import { z } from 'zod';
import { isAllowedPushEndpoint, validMealTime, validTimeZone } from '@/domain/meal-reminder.policy';

export const mealReminderSettingsSchema = z
  .object({
    breakfastTime: z
      .string()
      .refine(
        (time) => validMealTime(time) && time >= '05:00' && time <= '10:00',
        'Choose a breakfast time from 5:00 to 10:00 AM.'
      ),
    lunchTime: z
      .string()
      .refine(
        (time) => validMealTime(time) && time >= '11:00' && time <= '15:00',
        'Choose a lunch time from 11:00 AM to 3:00 PM.'
      ),
    dinnerTime: z
      .string()
      .refine(
        (time) => validMealTime(time) && time >= '17:00' && time <= '23:00',
        'Choose a dinner time from 5:00 to 11:00 PM.'
      ),
    timeZone: z.string().min(1).max(80).refine(validTimeZone, 'Choose a valid timezone.'),
    remindersEnabled: z.boolean(),
    prepareEnabled: z.boolean(),
    prepareMinutesBefore: z.number().int().min(0).max(180).optional(),
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
