interface ApiErrorShape {
  response?: {
    data?: {
      error?: unknown;
      errorCode?: unknown;
      code?: unknown;
    };
  };
}

const apiErrorData = (error: unknown) => (error as ApiErrorShape | null)?.response?.data;

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const message = apiErrorData(error)?.error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function getApiErrorCode(error: unknown): string | null {
  const data = apiErrorData(error);
  // Older explicit controller catches use `code`; the global handler uses `errorCode`.
  const code = typeof data?.errorCode === 'string' && data.errorCode.trim() ? data.errorCode : data?.code;
  return typeof code === 'string' && code.trim() ? code : null;
}
