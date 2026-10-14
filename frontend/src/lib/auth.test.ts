import { describe, expect, it, vi } from 'vitest';
import { decodeToken, isTokenExpired } from './auth';

const claims = { userId: 'fixture', email: 'fixture@example.test', role: 'USER', iat: 1, exp: 4_000_000_000 };
const token = (payload: unknown) => `${btoa('{}')}.${btoa(JSON.stringify(payload))}.fixture`;

describe('cached access token parsing', () => {
  it('treats missing or malformed tokens as signed out without console errors', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const value of ['', 'undefined', 'null', 'bad.payload.signature', token(null)]) {
      expect(decodeToken(value)).toBeNull();
      expect(isTokenExpired(value)).toBe(true);
    }
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it.each([
    { ...claims, userId: '' }, { ...claims, email: null }, { ...claims, role: 'UNKNOWN' },
    { ...claims, exp: 'tomorrow' }, { ...claims, iat: undefined },
  ])('rejects malformed identity claims', (payload) => {
    expect(decodeToken(token(payload))).toBeNull();
  });

  it('retains valid claims and detects expiry at the exact boundary', () => {
    expect(decodeToken(token(claims))).toEqual(claims);
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    expect(isTokenExpired(token({ ...claims, exp: 10 }))).toBe(true);
    expect(isTokenExpired(token({ ...claims, exp: 11 }))).toBe(false);
    now.mockRestore();
  });
});
