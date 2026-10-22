import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { MobileAuthController, requireMobileTransport } from '../src/controllers/mobile-auth.controller';
import AuthService from '../src/services/auth.service';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { request as httpRequest } from 'node:http';
import authRouter from '../src/routes/auth.routes';

function result() {
  let code = 200;
  let data: Record<string, unknown> = {};
  const headers: Record<string, string> = {};
  const res = {
    status(value: number) {
      code = value;
      return this;
    },
    json(value: Record<string, unknown>) {
      data = value;
      return this;
    },
    set(key: string, value: string) {
      headers[key] = value;
      return this;
    },
  } as unknown as Response;
  return {
    res,
    get status() {
      return code;
    },
    get body() {
      return data;
    },
    headers,
  };
}
test('native session transport is disabled by default and rejects browser-origin requests', (t) => {
  const previous = process.env.MOBILE_AUTH_ENABLED;
  t.after(() => {
    if (previous === undefined) delete process.env.MOBILE_AUTH_ENABLED;
    else process.env.MOBILE_AUTH_ENABLED = previous;
  });
  delete process.env.MOBILE_AUTH_ENABLED;
  let admitted = 0;
  const disabled = result();
  requireMobileTransport({ headers: {} } as Request, disabled.res, () => admitted++);
  assert.equal(disabled.status, 404);
  assert.equal(admitted, 0);
  process.env.MOBILE_AUTH_ENABLED = 'true';
  for (const headers of [
    { origin: 'https://kainara.site' },
    { 'sec-fetch-site': 'same-origin' },
    { 'sec-fetch-mode': 'navigate' },
  ]) {
    const browser = result();
    requireMobileTransport({ headers } as Request, browser.res, () => admitted++);
    assert.equal(browser.status, 403);
  }
  const native = result();
  requireMobileTransport({ headers: {} } as Request, native.res, () => admitted++);
  assert.equal(admitted, 1);
  assert.equal(native.headers['Cache-Control'], 'private, no-store');
});
test('mobile login exposes only the service public result and never sets a browser cookie', async (t) => {
  const payload = { user: { id: 'member', role: 'USER' }, accessToken: 'access', refreshToken: 'refresh' };
  t.mock.method(AuthService, 'login', async () => payload);
  const output = result();
  await MobileAuthController.login(
    { body: { email: 'member@example.test', password: 'Secret123' } } as Request,
    output.res
  );
  assert.equal(output.status, 200);
  assert.deepEqual(output.body.data, payload);
});
test('staff login is refused and its just-created session is revoked', async (t) => {
  t.mock.method(AuthService, 'login', async () => ({
    user: { id: 'staff', role: 'ADMIN' },
    accessToken: 'access',
    refreshToken: 'staff-refresh',
  }));
  const revoked: string[] = [];
  t.mock.method(AuthService, 'logoutWithRefreshToken', async (token: string) => {
    revoked.push(token);
  });
  const output = result();
  await MobileAuthController.login(
    { body: { email: 'staff@example.test', password: 'Secret123' } } as Request,
    output.res
  );
  assert.equal(output.status, 403);
  assert.deepEqual(revoked, ['staff-refresh']);
  assert.equal(output.body.data, undefined);
});
test('refresh uses existing rotation and never treats database failure as revoked credentials', async (t) => {
  t.mock.method(AuthService, 'refreshToken', async (token: string) => {
    assert.equal(token, 'current-refresh');
    return { accessToken: 'next-access', refreshToken: 'next-refresh' };
  });
  const output = result();
  await MobileAuthController.refresh({ body: { refreshToken: 'current-refresh' } } as Request, output.res);
  assert.deepEqual(output.body.data, { accessToken: 'next-access', refreshToken: 'next-refresh' });
  t.mock.method(AuthService, 'refreshToken', async () => {
    const error = new Error('do-not-leak-database-host');
    error.name = 'PrismaClientInitializationError';
    throw error;
  });
  const unavailable = result();
  await MobileAuthController.refresh({ body: { refreshToken: 'current-refresh' } } as Request, unavailable.res);
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(JSON.stringify(unavailable.body), /do-not-leak/);
});
test('native logout revokes exactly the supplied refresh session', async (t) => {
  const revoked: string[] = [];
  t.mock.method(AuthService, 'logoutWithRefreshToken', async (token: string) => {
    revoked.push(token);
  });
  const output = result();
  await MobileAuthController.logout({ body: { refreshToken: 'only-this-device' } } as Request, output.res);
  assert.equal(output.status, 200);
  assert.deepEqual(revoked, ['only-this-device']);
});

test('real HTTP routes keep browser auth isolated and validate native input before service calls', async (t) => {
  const previous = process.env.MOBILE_AUTH_ENABLED;
  t.after(() => {
    if (previous === undefined) delete process.env.MOBILE_AUTH_ENABLED;
    else process.env.MOBILE_AUTH_ENABLED = previous;
  });
  const payload = {
    user: { id: 'member', role: 'USER' },
    accessToken: 'native-access',
    refreshToken: 'native-refresh',
  };
  let loginCalls = 0;
  t.mock.method(AuthService, 'login', async () => {
    loginCalls++;
    return payload;
  });
  t.mock.method(AuthService, 'refreshToken', async () => ({
    accessToken: 'rotated-access',
    refreshToken: 'rotated-refresh',
  }));
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`;
  // Node fetch inserts Sec-Fetch-Mode like a browser. Native HTTP clients do not.
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    new Promise<globalThis.Response>((resolve, reject) => {
      const request = httpRequest(
        base + path,
        { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers } },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          response.on('error', reject);
          response.on('end', () => {
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(response.headers)) {
              if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
            }
            resolve(
              new globalThis.Response(Buffer.concat(chunks), { status: response.statusCode, headers: responseHeaders })
            );
          });
        }
      );
      request.on('error', reject);
      request.end(JSON.stringify(body));
    });
  delete process.env.MOBILE_AUTH_ENABLED;
  assert.equal((await post('/mobile/login', {})).status, 404);
  process.env.MOBILE_AUTH_ENABLED = 'true';
  assert.equal(
    (
      await post(
        '/mobile/login',
        { email: 'member@example.test', password: 'password' },
        { Origin: 'https://kainara.site' }
      )
    ).status,
    403
  );
  assert.equal((await post('/mobile/login', { email: 'invalid', password: 'password' })).status, 400);
  assert.equal((await post('/mobile/refresh', { refreshToken: 'short' })).status, 400);
  assert.equal(loginCalls, 0);
  const native = await post('/mobile/login', { email: 'member@example.test', password: 'password' });
  assert.equal(native.status, 200);
  assert.equal(native.headers.get('set-cookie'), null);
  assert.equal(native.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(((await native.json()) as { data: unknown }).data, payload);
  const browser = await post('/login', { email: 'member@example.test', password: 'password' });
  assert.equal(browser.status, 200);
  assert.match(browser.headers.get('set-cookie') ?? '', /HttpOnly/i);
  const browserBody = (await browser.json()) as { data: { accessToken: string; refreshToken?: string } };
  assert.equal(browserBody.data.refreshToken, undefined);
  assert.equal(browserBody.data.accessToken, 'native-access');
  const rotated = await post('/mobile/refresh', { refreshToken: 'valid-native-refresh-token' });
  assert.equal(rotated.status, 200);
  assert.deepEqual(((await rotated.json()) as { data: unknown }).data, {
    accessToken: 'rotated-access',
    refreshToken: 'rotated-refresh',
  });
});
