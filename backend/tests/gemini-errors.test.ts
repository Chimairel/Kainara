import assert from 'node:assert/strict';
import test from 'node:test';
import { memberSafeGeminiError } from '../src/domain/gemini-error.policy';
import { AppError } from '../src/errors/AppError';
import { AiCapacityDeferredError } from '../src/services/ai-capacity.service';

test('Gemini failures distinguish overload, timeout, transport, invalid results and configuration safely', () => {
  const cases = [
    [{ status: 503, message: 'secret provider URL?key=private' }, 'AI_HIGH_DEMAND', 503],
    [{ name: 'AbortError', message: 'operation aborted' }, 'AI_TIMEOUT', 504],
    [new Error('fetch failed: private host'), 'AI_CONNECTION_ERROR', 503],
    [new Error('Failed to parse or validate the response from model internal-id.'), 'AI_INVALID_RESPONSE', 502],
    [{ status: 403, message: 'API key private is invalid' }, 'AI_SERVICE_CONFIGURATION', 503],
    [{ status: 500, message: 'provider internal details' }, 'AI_UNAVAILABLE', 503],
  ] as const;
  for (const [cause, code, status] of cases) {
    const result = memberSafeGeminiError(cause);
    assert.equal(result.errorCode, code);
    assert.equal(result.statusCode, status);
    assert.doesNotMatch(result.message, /private|secret|internal|key=/i);
  }
});

test('Capacity errors retain worker deferral and expose a safe HTTP code', () => {
  const retryAt = new Date(Date.now() + 60_000);
  const busy = new AiCapacityDeferredError('AI is busy.', retryAt);
  assert.ok(busy instanceof AppError);
  assert.ok(busy instanceof AiCapacityDeferredError);
  assert.equal(busy.statusCode, 429);
  assert.equal(busy.retryAt, retryAt);
  const overloaded = new AiCapacityDeferredError('AI is experiencing high demand.', retryAt, 'AI_HIGH_DEMAND');
  assert.equal(overloaded.statusCode, 503);
});
