import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '@/errors/AppError';
import { sendApiError } from '@/lib/http-response';
import { logger } from '@/lib/logger';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function notFoundHandler(req: Request, res: Response): Response {
  return sendApiError(res, 404, `Route ${req.method} ${req.path} was not found.`, 'ROUTE_NOT_FOUND');
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): Response {
  const parserError = error as { type?: unknown; status?: unknown } | null;
  const appError =
    error instanceof AppError
      ? error
      : parserError?.type === 'entity.too.large' && parserError.status === 413
        ? new AppError('The request exceeds the permitted upload size.', 413, 'PAYLOAD_TOO_LARGE')
        : parserError?.type === 'entity.parse.failed' && parserError.status === 400
          ? new AppError('The request must contain valid JSON.', 400, 'INVALID_JSON')
          : null;
  const statusCode = appError?.statusCode ?? 500;
  const errorCode = appError?.errorCode ?? 'INTERNAL_ERROR';
  const message = appError?.message ?? sanitizeErrorMessage(error, 'An unexpected error occurred.');

  logger.error('request_failed', {
    requestId: res.locals.requestId,
    method: req.method,
    path: req.path,
    statusCode,
    errorCode,
    errorName: error instanceof Error ? error.name : typeof error,
  });

  return sendApiError(res, statusCode, statusCode >= 500 ? 'An unexpected error occurred.' : message, errorCode);
}
