import { z } from 'zod';
import { AppError } from '@/errors/AppError';

// bcrypt only hashes the first 72 UTF-8 bytes. Reject truncation on new writes;
// leave legacy sign-in/current-password checks compatible with existing hashes.
export const passwordFitsBcrypt = (value: unknown): boolean =>
  typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72;

export const newPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(128, 'Password must be 128 characters or fewer.')
  .regex(/\S/, 'Password cannot consist only of spaces.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.')
  .regex(/^[^\u0000-\u001F\u007F]+$/u, 'Password cannot contain control characters.')
  .refine(passwordFitsBcrypt, 'Password is too long. Use a shorter password (at most 72 UTF-8 bytes).');

export function assertNewPassword(value: unknown): void {
  const parsed = newPasswordSchema.safeParse(value);
  if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400, 'INVALID_PASSWORD');
}
