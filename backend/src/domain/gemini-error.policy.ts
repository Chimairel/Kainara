import { AppError } from '../errors/AppError';

/** Translate provider diagnostics into member-safe messages. Never expose raw provider URLs or keys. */
export function memberSafeGeminiError(cause: unknown): AppError {
  const error = cause as { status?: unknown; name?: unknown; message?: unknown } | null;
  const message = typeof error?.message === 'string' ? error.message : '';
  if (error?.status === 503 || /high demand|overloaded/iu.test(message)) {
    return new AppError('AI is experiencing high demand right now. Please try again shortly.', 503, 'AI_HIGH_DEMAND');
  }
  if (error?.name === 'AbortError' || /timeout|timed out|aborted/iu.test(message)) {
    return new AppError('AI took too long to respond. Please try again.', 504, 'AI_TIMEOUT');
  }
  if (/fetch failed|network|ECONNRESET|ENOTFOUND|ECONNREFUSED/iu.test(message)) {
    return new AppError('We could not connect to AI. Please try again shortly.', 503, 'AI_CONNECTION_ERROR');
  }
  if (/parse or validate|empty response|response validation/iu.test(message)) {
    return new AppError('AI could not return usable results. Please try again.', 502, 'AI_INVALID_RESPONSE');
  }
  if (error?.status === 401 || error?.status === 403 || error?.status === 404) {
    return new AppError('AI is unavailable right now. Please try again later.', 503, 'AI_SERVICE_CONFIGURATION');
  }
  return new AppError('AI is temporarily unavailable. Please try again later.', 503, 'AI_UNAVAILABLE');
}
