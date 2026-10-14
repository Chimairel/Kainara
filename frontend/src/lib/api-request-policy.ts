/** Bounded browser budgets, including pool acquisition and server transaction time. */
export function getApiRequestTimeout(method: string = 'get', url: string = ''): number {
  const verb = method.toLowerCase();
  const path = url.replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0].replace(/^\/api(?=\/)/, '');
  const mutation = ['post', 'put', 'patch', 'delete'].includes(verb);

  if (verb === 'post' &&
    (path === '/admin/meals/batch/import' || /^\/admin\/data\/releases\/[^/]+\/consumption-import$/.test(path))) {
    return 180_000;
  }
  // Grocery reads can rebuild a stale list using a 90-second transaction.
  if (path.startsWith('/user/grocery/')) return 120_000;
  if (mutation &&
    (/^\/user\/meals\/(generate|log-outside)$/.test(path) ||
      /^\/nutritionist\/review\/[^/]+\/regenerate-candidate$/.test(path) ||
      /^\/nutritionist\/queue\/[^/]+\/swap-filter$/.test(path) ||
      path === '/user/onboarding/safety-preview' || path === '/user/nutrition-report/generate')) {
    return 120_000;
  }
  // Polling and notification requests stay short; their hooks prevent overlap.
  if ((verb === 'get' || verb === 'head') &&
    (path === '/user/meals/generation-status' || /^\/user\/notifications(?:\/|$)/.test(path))) return 30_000;
  if ((verb === 'get' || verb === 'head' || mutation) &&
    /^\/(admin|nutritionist|user)\//.test(path)) return 90_000;
  if (verb === 'post' && /^\/auth\/(login|google\/(continue|login|register))$/.test(path)) return 60_000;
  if (mutation && /^\/(auth|support|nutritionist-applications)(?:\/|$)/.test(path)) return 90_000;
  return 30_000;
}
