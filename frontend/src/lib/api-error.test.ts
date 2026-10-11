import { describe, expect, it } from 'vitest';
import { getApiErrorCode, getApiErrorMessage } from './api-error';

describe('API error helpers', () => {
  it('returns bounded public API fields when they are strings', () => {
    const error = { response: { data: { error: 'Try again later.', errorCode: 'RETRY_LATER' } } };
    expect(getApiErrorMessage(error, 'Fallback')).toBe('Try again later.');
    expect(getApiErrorCode(error)).toBe('RETRY_LATER');
  });

  it('uses safe fallbacks for malformed and unrelated errors', () => {
    expect(getApiErrorMessage(new Error('private detail'), 'Safe fallback')).toBe('Safe fallback');
    expect(getApiErrorMessage({ response: { data: { error: { secret: true } } } }, 'Safe fallback')).toBe(
      'Safe fallback'
    );
    expect(getApiErrorCode({ response: { data: { errorCode: 500 } } })).toBeNull();
  });
});

it('recognizes both API error envelopes so stale-context recovery is consistent', () => {
  expect(getApiErrorCode({ response: { data: { code: 'MEAL_REVIEW_CONTEXT_CHANGED' } } })).toBe(
    'MEAL_REVIEW_CONTEXT_CHANGED'
  );
  expect(getApiErrorCode({ response: { data: { errorCode: 'MEAL_REVIEW_CONTEXT_CHANGED' } } })).toBe(
    'MEAL_REVIEW_CONTEXT_CHANGED'
  );
  expect(getApiErrorCode({ response: { data: { errorCode: 'CURRENT', code: 'LEGACY' } } })).toBe('CURRENT');
  expect(getApiErrorCode({ response: { data: { code: 409 } } })).toBeNull();
  expect(getApiErrorCode(null)).toBeNull();
});
