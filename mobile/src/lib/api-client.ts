import type { Envelope, Tokens } from './contracts.ts';

export class ApiError extends Error {
  status: number;
  code?: string;
  retryAt?: string;
  constructor(message: string, status: number, code?: string, retryAt?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAt = retryAt;
  }
}
export type Vault = { read(): Promise<Tokens | null>; write(tokens: Tokens): Promise<void>; clear(): Promise<void> };
export function createApiClient(baseUrl: string, vault: Vault, fetcher: typeof fetch = fetch) {
  let tokens: Tokens | null = null;
  let epoch = 0;
  let refreshing: Promise<void> | null = null;
  let onExpired = () => {};
  async function transport<T>(
    path: string,
    method: string,
    body?: unknown,
    authenticated = true
  ): Promise<Envelope<T>> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Use a relative API path.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), path.includes('/assistant/messages') ? 90_000 : 30_000);
    try {
      const response = await fetcher(baseUrl + path, {
        method,
        signal: controller.signal,
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          ...(authenticated && tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const value = (await response.json().catch(() => null)) as Envelope<T> | null;
      if (!response.ok || !value?.success)
        throw new ApiError(
          value?.error ?? `Request failed (${response.status}). Try again.`,
          response.status,
          value?.errorCode,
          value?.retryAt
        );
      return value;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Could not reach KAINARA. Check your connection. A submitted action may still have completed; refresh before retrying.',
        0
      );
    } finally {
      clearTimeout(timer);
    }
  }
  async function expire() {
    epoch++;
    tokens = null;
    refreshing = null;
    try {
      await vault.clear();
    } finally {
      onExpired();
    }
  }
  async function accept(value: Tokens, expectedEpoch: number) {
    if (!value.accessToken || !value.refreshToken) throw new Error('The server did not return a mobile session.');
    if (epoch !== expectedEpoch) throw new Error('The session changed.');
    await vault.write({ accessToken: value.accessToken, refreshToken: value.refreshToken });
    if (epoch !== expectedEpoch) {
      await vault.clear();
      throw new Error('The session changed.');
    }
    tokens = { accessToken: value.accessToken, refreshToken: value.refreshToken };
  }
  async function refresh() {
    if (refreshing) return refreshing;
    const expectedEpoch = epoch;
    refreshing = (async () => {
      if (!tokens) tokens = await vault.read();
      if (!tokens) throw new ApiError('Sign in to continue.', 401);
      try {
        const response = await transport<Tokens>(
          '/auth/mobile/refresh',
          'POST',
          { refreshToken: tokens.refreshToken },
          false
        );
        await accept(response.data, expectedEpoch);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401 && expectedEpoch === epoch) await expire();
        throw error;
      }
    })();
    try {
      await refreshing;
    } finally {
      if (expectedEpoch === epoch) refreshing = null;
    }
  }
  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<Envelope<T>> {
    const expectedEpoch = epoch;
    const failedAccessToken = tokens?.accessToken;
    try {
      return await transport<T>(path, method, body);
    } catch (error) {
      // Only an explicit unauthenticated rejection may be retried. Never replay
      // network/5xx mutation failures or a request under a different session.
      if (!(error instanceof ApiError) || error.status !== 401 || epoch !== expectedEpoch) throw error;
      if (failedAccessToken === tokens?.accessToken) await refresh();
      if (epoch !== expectedEpoch) throw error;
      return transport<T>(path, method, body);
    }
  }
  return {
    request,
    publicRequest: transport,
    async signIn(path: '/auth/mobile/login' | '/auth/mobile/register', body: unknown) {
      const expectedEpoch = ++epoch;
      const response = await transport<Tokens>(path, 'POST', body, false);
      await accept(response.data, expectedEpoch);
    },
    async restore() {
      tokens = await vault.read();
      if (!tokens) return false;
      await refresh();
      return true;
    },
    async signOut() {
      if (refreshing) await refreshing;
      const saved = tokens ?? (await vault.read());
      if (saved) await transport('/auth/mobile/logout', 'POST', { refreshToken: saved.refreshToken }, false);
      await expire();
    },
    setExpiredHandler(handler: () => void) {
      onExpired = handler;
    },
    async clearRejectedSession() {
      await expire();
    },
    get accessToken() {
      return tokens?.accessToken;
    },
  };
}
