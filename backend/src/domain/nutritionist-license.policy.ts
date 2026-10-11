import { z } from 'zod';
import { getManilaBusinessDateKey } from './meal-actionability.policy';
import { detectClinicalDocumentMime } from '@/lib/clinical-document-crypto';
import { AppError } from '@/errors/AppError';

export const LICENSE_DOCUMENT_MAX_BYTES = 4 * 1024 * 1024;
export const licenseDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((day) => {
    const date = new Date(`${day}T00:00:00+08:00`);
    return !Number.isNaN(date.getTime()) && getManilaBusinessDateKey(date) === day;
  }, 'Choose a valid license expiry date.');
export const licenseUpdateSchema = z
  .object({
    purpose: z.enum(['RENEWAL', 'CORRECTION']),
    licenseNumber: z.string().trim().min(1).max(80),
    expiryDate: licenseDaySchema,
    reason: z.string().trim().min(10).max(1500),
    consentAccepted: z.union([z.literal(true), z.literal('true')]),
  })
  .strict();
export const licenseDecisionSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    reason: z.string().trim().min(10).max(1500),
  })
  .strict();
export type LicenseUpdateInput = z.infer<typeof licenseUpdateSchema>;
export function licenseExpiryAtEndOfDay(day: string) {
  return new Date(`${licenseDaySchema.parse(day)}T23:59:59.999+08:00`);
}
export function assertLicenseProposal(
  input: LicenseUpdateInput,
  previousNumber: string,
  previousExpiry: Date,
  now = new Date()
) {
  const previousDay = getManilaBusinessDateKey(previousExpiry)!;
  if (input.expiryDate < getManilaBusinessDateKey(now)!)
    throw new AppError('The submitted license is already expired.', 422, 'LICENSE_ALREADY_EXPIRED');
  if (input.licenseNumber === previousNumber && input.expiryDate === previousDay)
    throw new AppError('The license details are unchanged. Submit updated details.', 422, 'LICENSE_UNCHANGED');
  if (input.purpose === 'RENEWAL' && input.expiryDate <= previousDay)
    throw new AppError(
      'A renewal must extend the recorded expiry date. Use correction for an incorrect record.',
      422,
      'LICENSE_RENEWAL_NOT_EXTENDED'
    );
}
export function validateLicenseDocument(file: { buffer: Buffer; mimetype: string; originalname: string }) {
  if (!file.buffer.length || file.buffer.length > LICENSE_DOCUMENT_MAX_BYTES)
    throw new AppError('Choose one license document up to 4 MB.', 413, 'LICENSE_DOCUMENT_TOO_LARGE');
  const mime = detectClinicalDocumentMime(file.buffer);
  if (!mime || mime !== file.mimetype)
    throw new AppError(
      'The document content must match its PDF, JPG or PNG file type.',
      422,
      'LICENSE_DOCUMENT_INVALID'
    );
  const fileName =
    file.originalname
      .split(/[\\/]/)
      .at(-1)
      ?.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
      .slice(0, 180) || 'license-document';
  return { mimeType: mime, originalFileName: fileName, byteSize: file.buffer.length };
}

export function credentialAccessState(
  profile: { isVerified: boolean; prcLicenseExpiry: Date } | null,
  emailVerified: boolean,
  applicationStatus: string | null,
  now = new Date()
) {
  const expiryDate = profile ? getManilaBusinessDateKey(profile.prcLicenseExpiry) : null;
  const reason = !emailVerified
    ? 'EMAIL_UNVERIFIED'
    : !profile
      ? 'PROFILE_MISSING'
      : applicationStatus && applicationStatus !== 'ACTIVATED'
        ? 'APPLICATION_INACTIVE'
        : !profile.isVerified
          ? 'CREDENTIAL_UNVERIFIED'
          : !expiryDate || expiryDate < getManilaBusinessDateKey(now)!
            ? 'LICENSE_EXPIRED'
            : null;
  return {
    eligible: reason === null,
    reason,
    expiryDate,
    canSubmitUpdate:
      !!profile?.isVerified && emailVerified && (!applicationStatus || applicationStatus === 'ACTIVATED'),
  };
}
