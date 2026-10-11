import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/errors/AppError';
import {
  assertLicenseProposal,
  credentialAccessState,
  licenseDaySchema,
  licenseExpiryAtEndOfDay,
  licenseUpdateSchema,
  validateLicenseDocument,
} from '../src/domain/nutritionist-license.policy';

test('The approved license remains valid through the entire Manila expiry date', () => {
  const profile = { isVerified: true, prcLicenseExpiry: licenseExpiryAtEndOfDay('2026-10-11') };
  assert.equal(credentialAccessState(profile, true, 'ACTIVATED', new Date('2026-10-11T15:59:59.999Z')).eligible, true);
  const expired = credentialAccessState(profile, true, 'ACTIVATED', new Date('2026-10-11T16:00:00Z'));
  assert.equal(expired.eligible, false);
  assert.equal(expired.reason, 'LICENSE_EXPIRED');
  assert.equal(expired.canSubmitUpdate, true);
});
test('Renewal cannot activate an unverified email, application or professional profile', () => {
  const profile = { isVerified: true, prcLicenseExpiry: new Date('2030-01-01') };
  assert.equal(credentialAccessState(profile, false, 'ACTIVATED').canSubmitUpdate, false);
  assert.equal(credentialAccessState(profile, true, 'APPROVED').canSubmitUpdate, false);
  assert.equal(credentialAccessState({ ...profile, isVerified: false }, true, 'ACTIVATED').canSubmitUpdate, false);
  assert.equal(credentialAccessState(null, true, null).canSubmitUpdate, false);
  assert.equal(
    credentialAccessState(profile, true, null).eligible,
    true,
    'Marked synthetic profiles retain their established application-free path.'
  );
});
test('Reject invalid calendar dates, expired/unchanged proposals and backward renewals', () => {
  assert.equal(licenseDaySchema.safeParse('2026-02-30').success, false);
  assert.equal(licenseDaySchema.safeParse('2026-13-01').success, false);
  const input = {
    purpose: 'RENEWAL' as const,
    licenseNumber: 'RND-1',
    expiryDate: '2027-10-11',
    reason: 'Current license renewal.',
    consentAccepted: true as const,
  };
  const now = new Date('2026-10-11T00:00:00Z');
  assert.doesNotThrow(() => assertLicenseProposal(input, 'RND-1', licenseExpiryAtEndOfDay('2026-10-04'), now));
  assert.throws(
    () => assertLicenseProposal({ ...input, expiryDate: '2026-10-10' }, 'RND-1', new Date('2025-01-01'), now),
    (e: unknown) => e instanceof AppError && e.errorCode === 'LICENSE_ALREADY_EXPIRED'
  );
  assert.throws(
    () => assertLicenseProposal(input, 'RND-1', licenseExpiryAtEndOfDay(input.expiryDate), now),
    /unchanged/
  );
  assert.throws(() => assertLicenseProposal(input, 'RND-1', new Date('2028-01-01'), now), /renewal must extend/);
  assert.doesNotThrow(() =>
    assertLicenseProposal({ ...input, purpose: 'CORRECTION' }, 'RND-1', new Date('2028-01-01'), now)
  );
  assert.equal(licenseUpdateSchema.safeParse({ ...input, consentAccepted: false }).success, false);
});
test('License uploads use bounded PDF/PNG/JPEG content and safe filenames', () => {
  const file = {
    buffer: Buffer.from('%PDF-1.4\nSynthetic license evidence'),
    mimetype: 'application/pdf',
    originalname: '../../license.pdf',
  };
  assert.equal(validateLicenseDocument(file).originalFileName, 'license.pdf');
  assert.throws(() => validateLicenseDocument({ ...file, mimetype: 'image/png' }), /content must match/);
  assert.throws(
    () => validateLicenseDocument({ ...file, buffer: Buffer.from('<svg>unsafe</svg>') }),
    /content must match/
  );
  assert.throws(() => validateLicenseDocument({ ...file, buffer: Buffer.alloc(4194305) }), /up to 4 MB/);
});
