import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiClient, ApiError, type Vault } from '../src/lib/api-client.ts';
import type { Tokens } from '../src/lib/contracts.ts';

const pair = (n: number): Tokens => ({ accessToken: `access-${n}`, refreshToken: `refresh-${n}` });
function storage(initial: Tokens | null = null) {
  let value = initial;
  const writes: (Tokens | null)[] = [];
  const vault: Vault = {
    read: async () => value,
    write: async (next) => {
      value = next;
      writes.push(next);
    },
    clear: async () => {
      value = null;
      writes.push(null);
    },
  };
  return {
    vault,
    writes,
    get current() {
      return value;
    },
  };
}
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('native login stores a single token pair and omits browser cookies', async () => {
  const store = storage();
  const calls: RequestInit[] = [];
  const client = createApiClient('https://staging.example/api', store.vault, (async (_url, init) => {
    calls.push(init!);
    return response(pair(1));
  }) as typeof fetch);
  await client.signIn('/auth/mobile/login', { email: 'member@example.test', password: 'never-log-this' });
  assert.deepEqual(store.current, pair(1));
  assert.equal(store.writes.length, 1);
  assert.equal(calls[0].credentials, 'omit');
  assert.equal((calls[0].headers as Record<string, string>).Authorization, undefined);
});
test('parallel explicit 401s rotate once and retry with the same new token', async () => {
  const store = storage(pair(1));
  let refreshes = 0;
  const seen: string[] = [];
  const client = createApiClient('https://staging.example/api', store.vault, (async (url, init) => {
    if (String(url).endsWith('/auth/mobile/refresh')) {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return response(pair(2));
    }
    const auth = (init?.headers as Record<string, string>).Authorization;
    seen.push(auth);
    return auth === 'Bearer access-2' ? response({ ok: true }) : response('Expired', 401);
  }) as typeof fetch);
  await Promise.all([client.request('/user/profile'), client.request('/user/meals/current')]);
  assert.equal(refreshes, 1);
  assert.deepEqual(store.current, pair(2));
  assert.equal(seen.filter((value) => value === 'Bearer access-2').length, 2);
});
test('uncertain write delivery is never automatically replayed', async () => {
  const store = storage();
  let writes = 0;
  const client = createApiClient('https://staging.example/api', store.vault, (async () => {
    writes++;
    throw new TypeError('network');
  }) as typeof fetch);
  await assert.rejects(client.request('/user/water', 'POST', { amountMl: 250 }), /may still have completed/);
  assert.equal(writes, 1);
});
test('server failures do not replay writes or discard refresh credentials', async () => {
  const store = storage(pair(1));
  let calls = 0;
  const client = createApiClient('https://staging.example/api', store.vault, (async () => {
    calls++;
    return response('Unavailable', 503);
  }) as typeof fetch);
  await assert.rejects(client.restore(), (error) => error instanceof ApiError && error.status === 503);
  assert.deepEqual(store.current, pair(1));
  assert.equal(calls, 1);
});
test('rejected refresh clears the device session and expires the UI', async () => {
  const store = storage(pair(1));
  let expired = 0;
  const client = createApiClient('https://staging.example/api', store.vault, (async () =>
    response('Revoked', 401)) as typeof fetch);
  client.setExpiredHandler(() => expired++);
  await assert.rejects(client.restore(), (error) => error instanceof ApiError && error.status === 401);
  assert.equal(store.current, null);
  assert.equal(client.accessToken, undefined);
  assert.equal(expired, 1);
});
test('logout failure preserves the session for an explicit revocation retry', async () => {
  const store = storage(pair(1));
  let mode = 'refresh';
  const client = createApiClient('https://staging.example/api', store.vault, (async () =>
    mode === 'refresh' ? response(pair(2)) : response('Unavailable', 503)) as typeof fetch);
  await client.restore();
  mode = 'logout';
  await assert.rejects(client.signOut());
  assert.deepEqual(store.current, pair(2));
});
test('logout revokes before removing the encrypted pair', async () => {
  const store = storage(pair(1));
  let logoutToken = '';
  const client = createApiClient('https://staging.example/api', store.vault, (async (url, init) => {
    if (String(url).endsWith('/refresh')) return response(pair(2));
    logoutToken = JSON.parse(init?.body as string).refreshToken;
    assert.deepEqual(store.current, pair(2));
    return response({});
  }) as typeof fetch);
  await client.restore();
  await client.signOut();
  assert.equal(logoutToken, 'refresh-2');
  assert.equal(store.current, null);
});
test('arbitrary remote request URLs cannot receive the bearer token', async () => {
  const client = createApiClient('https://staging.example/api', storage().vault, (async () => {
    assert.fail('must not fetch');
  }) as typeof fetch);
  await assert.rejects(client.request('https://attacker.test/'), /relative API path/);
  await assert.rejects(client.request('//attacker.test/'), /relative API path/);
});
