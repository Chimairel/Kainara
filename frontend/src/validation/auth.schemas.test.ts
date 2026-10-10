import { describe, expect, it } from 'vitest';
import {
  getLoginFieldErrors,
  getRegistrationFieldErrors,
  registrationSchema,
  passwordSchema,
  loginSchema,
} from './auth.schemas';

describe('authentication validation', () => {
  it('blocks truncation on new passwords at the UTF-8 byte boundary and preserves legacy login', () => {
    const prefix = 'A1' + 'x'.repeat(70);
    expect(passwordSchema.safeParse(prefix).success).toBe(true);
    expect(passwordSchema.safeParse(prefix + 'suffix').success).toBe(false);
    expect(passwordSchema.safeParse('A1' + 'é'.repeat(35)).success).toBe(true);
    expect(passwordSchema.safeParse('A1' + 'é'.repeat(36)).success).toBe(false);
    expect(passwordSchema.safeParse('A1' + '😀'.repeat(18)).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'legacy@example.test', password: prefix + 'suffix' }).success).toBe(true);
  });
  it('trims names and email while preserving an intentional password', () => {
    const result = registrationSchema.parse({
      firstName: '  Chimairel ',
      lastName: ' Test ',
      email: ' TEST+NUTRIMIND@GMAIL.COM ',
      password: 'Valid pass 123',
      confirmPassword: 'Valid pass 123',
    });
    expect(result.firstName).toBe('Chimairel');
    expect(result.lastName).toBe('Test');
    expect(result.email).toBe('TEST+NUTRIMIND@GMAIL.COM');
    expect(result.password).toBe('Valid pass 123');
  });

  it('reports mismatched confirmation on the confirmation field', () => {
    const { errors } = getRegistrationFieldErrors({
      firstName: 'Test',
      lastName: 'Account',
      email: 'test@example.com',
      password: 'ValidPassword1',
      confirmPassword: 'DifferentPassword1',
    });
    expect(errors.confirmPassword).toBe('Passwords do not match.');
  });

  it('rejects whitespace-only login values', () => {
    const { errors } = getLoginFieldErrors({ email: '   ', password: '   ' });
    expect(errors.email).toBeTruthy();
    expect(errors.password).toBe('Password cannot consist only of spaces.');
  });
});
