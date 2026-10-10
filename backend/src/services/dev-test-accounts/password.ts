import { createHmac } from 'node:crypto';

/** Server-only development credential; never use this policy for ordinary accounts. */
export function sharedTestAccountPassword(env: NodeJS.ProcessEnv): string {
  if (!['development', 'test'].includes(env.NODE_ENV ?? '') || (env.NUTRIMIND_DEPLOYMENT_MODE ?? 'public') !== 'public')
    throw new Error('Shared test credentials require a development/test runtime.');
  let password = env.DEV_TEST_ACCOUNT_PASSWORD;
  if (password === undefined) {
    if (!env.JWT_SECRET) throw new Error('Shared test credential configuration is unavailable.');
    password = createHmac('sha256', env.JWT_SECRET).update('kainara:synthetic-account-password:v1').digest('base64url');
  }
  if (password.length < 16 || Buffer.byteLength(password, 'utf8') > 72)
    throw new Error('Test password must be at least 16 characters and at most 72 UTF-8 bytes.');
  return password;
}
