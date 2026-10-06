import crypto from 'crypto';

/**
 * Generates a cryptographically secure 6-digit OTP.
 */
export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Generates a cryptographically secure random hex token for password resets.
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
