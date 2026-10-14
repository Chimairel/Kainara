import { jwtDecode } from 'jwt-decode';
import { JWTPayload } from '@/types';

/**
 * Decodes a JWT token on the client side to inspect claims (e.g., role, user id).
 * NOTE: This is for visual route/state changes and does NOT verify the signature.
 */
export const decodeToken = (token: string): JWTPayload | null => {
  if (!token || token.split('.').length !== 3) return null;
  try {
    const claims = jwtDecode<JWTPayload>(token);
    if (
      !claims ||
      typeof claims.userId !== 'string' ||
      !claims.userId.trim() ||
      typeof claims.email !== 'string' ||
      !claims.email.includes('@') ||
      !['USER', 'NUTRITIONIST', 'ADMIN'].includes(claims.role) ||
      typeof claims.exp !== 'number' ||
      !Number.isFinite(claims.exp) ||
      typeof claims.iat !== 'number' ||
      !Number.isFinite(claims.iat)
    ) {
      return null;
    }
    return claims;
  } catch {
    // Missing/corrupt cached sessions are an ordinary signed-out state.
    // Never log token payloads; the API remains responsible for authentication.
    return null;
  }
};

/**
 * Checks if a JWT token has expired based on its 'exp' claim.
 */
export const isTokenExpired = (token: string): boolean => {
  const decoded = decodeToken(token);
  if (!decoded) return true;

  // exp is in seconds, Date.now() in milliseconds
  const currentTime = Date.now() / 1000;
  return decoded.exp <= currentTime;
};

/**
 * Basic document.cookie helpers for frontend token caching or configurations.
 */
export const cookieHelper = {
  get(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  },

  set(name: string, value: string, daysActive = 7, path = '/'): void {
    if (typeof document === 'undefined') return;
    let expires = '';
    if (daysActive) {
      const date = new Date();
      date.setTime(date.getTime() + daysActive * 24 * 60 * 60 * 1000);
      expires = `; expires=${date.toUTCString()}`;
    }
    const isSecure = window.location.protocol === 'https:';
    document.cookie = `${name}=${value || ''}${expires}; path=${path}; SameSite=Lax${isSecure ? '; Secure' : ''}`;
  },

  clear(name: string, path = '/'): void {
    if (typeof document === 'undefined') return;
    const isSecure = window.location.protocol === 'https:';
    document.cookie = `${name}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax${isSecure ? '; Secure' : ''}`;
  },
};
