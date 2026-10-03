import axios from 'axios';
import { cookieHelper } from '@/lib/auth';

/**
 * Resolves the API base URL.
 * - In the browser: if accessed remotely (e.g. mobile device, tunnel, LAN IP) where localhost
 *   would fail, or if explicitly set to '/api', defaults to '/api' to route through the Next.js reverse proxy.
 * - If an explicit production remote URL is provided in NEXT_PUBLIC_API_URL, it is preserved.
 * - On desktop localhost or SSR, it defaults to the configured URL or 'http://localhost:5000/api'.
 */
export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
      return configured;
    }
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost || configured === '/api') {
      return '/api';
    }
  }
  return configured || 'http://localhost:5000/api';
}

// Create a single pre-configured Axios instance for backend calls
const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30_000,
  withCredentials: true, // Crucial for storing and sending HttpOnly session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token from cookie as Authorization header
// The backend expects "Authorization: Bearer <token>" on every protected route
api.interceptors.request.use((config) => {
  // Current/workspace reads revalidate saved cycle and meal evidence. Under
  // database load they can exceed the ordinary 30-second read budget.
  if (
    config.timeout === api.defaults.timeout &&
    config.method === 'get' &&
    /^\/user\/meals\/(current|workspace)$/.test(config.url ?? '')
  ) {
    config.timeout = 90_000;
  }
  // Provider-backed operations have a longer, bounded budget than ordinary reads.
  if (
    config.timeout === api.defaults.timeout &&
    (/^\/user\/meals\/(generate|log-outside)$/.test(config.url ?? '') ||
      /^\/nutritionist\/review\/[^/]+\/regenerate-candidate$/.test(config.url ?? ''))
  ) {
    config.timeout = 120_000;
  }
  const token = cookieHelper.get('nutrimind_session');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let sessionRefreshSuppressed = false;
let sessionEpoch = 0;
let refreshController: AbortController | null = null;

export function setSessionRefreshSuppressed(suppressed: boolean) {
  sessionRefreshSuppressed = suppressed;
  if (suppressed) {
    sessionEpoch += 1;
    refreshController?.abort();
    refreshController = null;
    isRefreshing = false;
    processQueue(new Error('The session was ended.'));
  }
}
interface FailedRequest {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}

let failedQueue: FailedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to manage routing dynamically upon session expiration
api.interceptors.response.use(
  (response) => {
    if (
      typeof window !== 'undefined' &&
      ['post', 'patch', 'put', 'delete'].includes(response.config.method?.toLowerCase() ?? '') &&
      response.config.url?.startsWith('/user/')
    )
      window.dispatchEvent(new Event('kainara:membership-updated'));
    if (
      typeof window !== 'undefined' &&
      ['post', 'patch', 'put', 'delete'].includes(response.config.method?.toLowerCase() ?? '') &&
      response.config.url?.startsWith('/nutritionist/')
    ) {
      window.dispatchEvent(new Event('nutrimind:review-work-updated'));
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Retry once on 503 or transient 500 (e.g. serverless DB wake-up cold start / reconnect) for idempotent requests
    if (
      error.response &&
      (error.response.status === 503 || error.response.status === 500) &&
      originalRequest &&
      !originalRequest._retryTransient &&
      (!originalRequest.method || ['get', 'head'].includes(originalRequest.method.toLowerCase()))
    ) {
      originalRequest._retryTransient = true;
      await new Promise((resolve) => setTimeout(resolve, 500));
      return api(originalRequest);
    }

    // Check if error is a 401 and we haven't already retried this request
    if (
      originalRequest &&
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !sessionRefreshSuppressed
    ) {
      // Guard: don't redirect/refresh if we're already on an auth page
      const authPages = [
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/verify-email',
        '/nutritionist-apply',
        '/nutritionist-invitation',
      ];
      const isAuthPage =
        typeof window !== 'undefined' && authPages.some((page) => window.location.pathname.startsWith(page));

      // Guard: if it's the refresh request itself that failed, don't retry!
      const isRefreshRequest = originalRequest.url && originalRequest.url.includes('/auth/refresh');

      if (!isAuthPage && !isRefreshRequest) {
        const requestEpoch = sessionEpoch;
        if (isRefreshing) {
          originalRequest._retry = true;
          // Queue this failed request while token is being refreshed
          return new Promise<string | null>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              if (requestEpoch !== sessionEpoch || sessionRefreshSuppressed) throw new Error('The session was ended.');
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;
        const controller = new AbortController();
        refreshController = controller;

        try {
          // Send refresh request — the HttpOnly cookie is sent automatically
          // by the browser because withCredentials is true on the api instance.
          const refreshResponse = await axios.post(
            `${getApiBaseUrl()}/auth/refresh`,
            {},
            {
              withCredentials: true,
              timeout: 15_000,
              signal: controller.signal,
            }
          );
          if (requestEpoch !== sessionEpoch || sessionRefreshSuppressed) throw new Error('The session was ended.');

          if (refreshResponse.data && refreshResponse.data.success) {
            const { accessToken } = refreshResponse.data.data;
            cookieHelper.set('nutrimind_session', accessToken, 7);
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;

            processQueue(null, accessToken);
            isRefreshing = false;
            refreshController = null;

            return api(originalRequest);
          }
          throw new Error('Session refresh returned an invalid response.');
        } catch (refreshError) {
          if (requestEpoch !== sessionEpoch) return Promise.reject(refreshError);
          processQueue(refreshError, null);
          isRefreshing = false;
          refreshController = null;

          // Only clear the access token — the backend clears the HttpOnly refresh cookie
          const status = (refreshError as { response?: { status?: number } }).response?.status;
          if (status === 401 || status === 400) {
            cookieHelper.clear('nutrimind_session');
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
          }
          return Promise.reject(refreshError);
        }
      }
    }

    // Handle 403 Forbidden — log but don't redirect.
    // The RouteGuard component handles role-based page access.
    // Redirecting here causes issues when background fetches (e.g. notifications)
    // hit role-restricted endpoints for non-USER accounts.
    if (error.response && error.response.status === 403) {
      console.warn('[Axios] 403 Forbidden on:', error.config?.url);
    }

    return Promise.reject(error);
  }
);

export default api;
