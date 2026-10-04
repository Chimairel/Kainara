import { expect, it } from 'vitest';
import { professionalAccessLabel, type NutritionistRow } from './model';

const now = new Date('2026-10-04T05:00:00Z');
const professional: NutritionistRow = {
  id: 'profile',
  prcLicenseNumber: 'synthetic',
  prcLicenseExpiry: '2026-10-04T00:00:00Z',
  isVerified: true,
  totalVerified: 10,
  user: { id: 'staff', name: 'Synthetic professional', email: 'fixture@example.invalid', role: 'NUTRITIONIST' },
};

it('treats the license expiry date as valid through the Manila day', () => {
  expect(professionalAccessLabel(professional, now)).toBe('Access active');
  expect(professionalAccessLabel({ ...professional, prcLicenseExpiry: '2026-10-03T00:00:00Z' }, now)).toContain(
    'License expired'
  );
  expect(professionalAccessLabel(professional, new Date('2026-10-04T16:00:00Z'))).toContain('License expired');
});
it('does not label suspended, unverified or former professionals as active', () => {
  expect(professionalAccessLabel({ ...professional, user: { ...professional.user, isSuspended: true } }, now)).toBe(
    'Access revoked'
  );
  expect(professionalAccessLabel({ ...professional, isVerified: false }, now)).toBe('Verification pending');
  expect(professionalAccessLabel({ ...professional, user: { ...professional.user, role: 'USER' } }, now)).toBe(
    'Nutritionist role not active'
  );
  expect(professionalAccessLabel({ ...professional, prcLicenseExpiry: 'bad' }, now)).toBe('License date unavailable');
});
