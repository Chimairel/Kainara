import { z } from 'zod';
import { newPasswordSchema } from './password.schemas';

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

const isoFutureDate = (label: string) =>
  z
    .string()
    .datetime({ offset: true })
    .refine((value) => new Date(value).getTime() > Date.now(), `${label} must be in the future.`);

export const nutritionistApplicationSchema = z
  .object({
    emailVerificationProof: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Verify your email address first.'),
    fullName: requiredText('Full name', 161)
      .regex(/[\p{L}]/u, 'Full name must contain at least one letter.')
      .regex(/^[\p{L}\p{M}'’ .-]+$/u, 'Full name contains unsupported characters.'),
    email: z.string().trim().toLowerCase().max(254).email('Enter a valid email address.'),
    phoneNumber: requiredText('Phone number', 30).regex(/^\+?[0-9 ()-]{7,25}$/, 'Enter a valid phone number.'),
    prcLicenseNumber: requiredText('PRC license number', 80).regex(
      /^[A-Za-z0-9-]+$/,
      'PRC license number may contain only letters, numbers, and hyphens.'
    ),
    prcLicenseExpiry: z
      .string()
      .datetime({ offset: true })
      .refine((value) => new Date(value).getTime() > Date.now(), 'PRC license must not be expired.'),
    specialization: requiredText('Specialization', 120),
    yearsOfExperience: z.number().int().min(0).max(70),
    university: requiredText('University', 180),
    professionalBio: requiredText('Professional background', 2000).min(
      40,
      'Professional background must be at least 40 characters.'
    ),
    officialHeadshot: z
      .string()
      .trim()
      .max(1000000)
      .regex(/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/, 'A PNG or JPEG headshot is required.'),
    photoRecentAttested: z.literal(true, { error: 'Confirm that your photo was taken within the past 30 days.' }),
    availableCallSlots: z
      .array(isoFutureDate('Call availability'))
      .min(2, 'Provide at least two available call schedules.')
      .max(3)
      .refine((slots) => new Set(slots).size === slots.length, 'Call availability options must be different.'),
    consent: z.literal(true, { error: 'You must confirm the application declaration.' }),
  })
  .strict();

export const applicationStatusLookupSchema = z
  .object({
    referenceCode: requiredText('Reference code', 32).transform((value) => value.toUpperCase()),
    email: z.string().trim().toLowerCase().max(254).email('Enter a valid email address.'),
  })
  .strict();

export const applicationStageSchema = z
  .object({
    status: z.enum(['UNDER_REVIEW', 'CALL_REQUIRED']),
    adminNotes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const applicationScheduleSchema = z
  .object({
    scheduledCallAt: isoFutureDate('Scheduled call'),
    meetingUrl: z
      .string()
      .trim()
      .url('Enter a valid meeting URL.')
      .max(500)
      .refine((value) => /^https?:\/\//i.test(value), 'Meeting URL must use HTTP or HTTPS.'),
    adminNotes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const applicationDecisionSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve'), adminNotes: z.string().trim().max(2000).optional() }).strict(),
  z
    .object({
      decision: z.literal('reject'),
      reason: requiredText('Rejection reason', 500),
      adminNotes: z.string().trim().max(2000).optional(),
    })
    .strict(),
]);

export const applicationCallVerificationSchema = z
  .object({
    identityMatched: z.literal(true, {
      error: 'Confirm that the call took place and the applicant matched the uploaded photo.',
    }),
  })
  .strict();

export const nutritionistInvitationAcceptanceSchema = z
  .object({
    token: requiredText('Invitation token', 200),
    password: newPasswordSchema,
  })
  .strict();

export const applicationLicenseLookupSchema = z
  .object({
    prcLicenseNumber: requiredText('PRC license number', 80)
      .min(5)
      .regex(/^[A-Za-z0-9-]+$/),
  })
  .strict();
