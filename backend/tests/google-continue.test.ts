import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { OAuth2Client } from 'google-auth-library';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'isolated-google-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'isolated-google-refresh-secret';
process.env.GOOGLE_CLIENT_ID = 'isolated-google-client';

test('Google continuation preserves identity, access and creation boundaries', async (t) => {
  let users: any[] = [];
  let accounts: any[] = [];
  let sessions: any[] = [];
  let application: { status: string } | null = null;
  let race = false;
  let claims: any = {};
  const localUser = (overrides = {}) => ({
    id: 'existing-user',
    email: 'person@gmail.com',
    name: 'Existing',
    role: 'USER',
    emailVerified: false,
    onboardingDone: false,
    tosAccepted: false,
    isSuspended: false,
    image: null,
    passwordLoginEnabled: true,
    ...overrides,
  });
  const reset = () => {
    users = [];
    accounts = [];
    sessions = [];
    application = null;
    race = false;
    claims = { email: 'person@gmail.com', sub: 'subject-one', email_verified: true };
  };
  const uniqueConflict = () => Object.assign(new Error('Unique constraint'), { code: 'P2002' });
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  globals.prisma = {
    user: {
      findUnique: async ({ where }: any) =>
        users.find((u) => (where.id ? u.id === where.id : u.email === where.email)) ?? null,
      create: async ({ data }: any) => {
        if (users.some((u) => u.email === data.email)) throw uniqueConflict();
        const { accounts: nested, ...fields } = data;
        const user = localUser({ ...fields, id: users.length ? `new-user-${users.length}` : 'new-user' });
        users.push(user);
        accounts.push({ ...nested.create, id: 'new-link', userId: user.id });
        if (race) {
          race = false;
          throw uniqueConflict();
        }
        return user;
      },
      update: async ({ where, data }: any) =>
        Object.assign(
          users.find((u) => u.id === where.id),
          data
        ),
      updateMany: async ({ where, data }: any) => {
        const matching = users.filter((user) => Object.entries(where).every(([key, value]) => user[key] === value));
        for (const user of matching) Object.assign(user, data);
        return { count: matching.length };
      },
    },
    account: {
      findFirst: async ({ where, include }: any) => {
        const account = accounts.find((a) => Object.entries(where).every(([k, v]) => a[k] === v));
        return account
          ? { ...account, ...(include?.user ? { user: users.find((u) => u.id === account.userId) } : {}) }
          : null;
      },
      create: async ({ data }: any) => {
        const a = { ...data, id: 'linked' };
        accounts.push(a);
        return a;
      },
      update: async ({ where, data }: any) =>
        Object.assign(
          accounts.find((a) => a.id === where.id),
          data
        ),
    },
    session: {
      create: async ({ data }: any) => {
        sessions.push(data);
        return data;
      },
    },
    nutritionistApplication: { findUnique: async () => application },
  };
  t.after(() => {
    globals.prisma = previous;
  });
  const verifier = t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async (options: any) => {
    assert.equal(options.audience, 'isolated-google-client');
    if (options.idToken === 'invalid') throw new Error('Invalid signature');
    return { getPayload: () => claims } as any;
  });
  const { default: AuthService } = await import('../src/services/auth.service');

  await t.test('returning Google identity cannot verify a changed contact inbox', async () => {
    reset();
    users.push(localUser({ email: 'changed@example.test' }));
    accounts.push({ id: 'link', userId: 'existing-user', provider: 'google', providerAccountId: 'subject-one' });
    const result = await AuthService.completeGoogleAuth(
      { email: 'person@gmail.com', sub: 'subject-one', emailAuthoritative: true },
      'CONTINUE'
    );
    assert.equal(result.user.emailVerified, false);
    assert.equal(users[0].email, 'changed@example.test');
  });
  const credential = 'verified-fixture-credential';

  await t.test('first continuation creates one regular account without completing onboarding or consent', async () => {
    reset();
    let admission = 0;
    const first = await AuthService.googleContinue(credential, async () => {
      admission++;
    });
    assert.equal(first.user.role, 'USER');
    assert.equal(first.user.emailVerified, true);
    assert.equal(first.user.onboardingDone, false);
    assert.equal(users[0].tosAccepted, false);
    assert.equal(users[0].passwordLoginEnabled, false);
    assert.equal(admission, 1);
    claims.email = 'changed@gmail.com';
    const returning = await AuthService.googleContinue(credential, async () =>
      assert.fail('returning user must not consume creation budget')
    );
    assert.equal(returning.user.id, first.user.id);
    assert.equal(users.length, 1);
    assert.equal(accounts.length, 1);
    assert.equal(sessions.length, 2);
    assert.notEqual(sessions[0].sessionToken, sessions[1].sessionToken);
  });

  await t.test('a raced creation re-reads the winner and consumes admission only once', async () => {
    reset();
    race = true;
    let admission = 0;
    const result = await AuthService.googleContinue(credential, async () => {
      admission++;
    });
    assert.equal(result.user.id, 'new-user');
    assert.equal(users.length, 1);
    assert.equal(accounts.length, 1);
    assert.equal(admission, 1);
    assert.equal(sessions.length, 1);
  });

  await t.test('invalid or unverified Google identities never create users or sessions', async () => {
    reset();
    await assert.rejects(() => AuthService.googleContinue('invalid'), /Invalid Google credential/);
    for (const verified of [false, undefined]) {
      claims.email_verified = verified;
      await assert.rejects(() => AuthService.googleContinue(credential), /verified account identity/);
    }
    assert.equal(users.length, 0);
    assert.equal(sessions.length, 0);
    assert.ok(verifier.mock.callCount() >= 3);
  });

  await t.test('Google-controlled email links the existing local account without creating a duplicate', async () => {
    for (const hosted of [false, true]) {
      reset();
      if (hosted) {
        claims.email = 'person@company.test';
        claims.hd = 'company.test';
      }
      users.push(localUser({ email: claims.email }));
      const result = await AuthService.googleContinue(credential);
      assert.equal(result.user.id, 'existing-user');
      assert.equal(result.user.emailVerified, true);
      assert.equal(users.length, 1);
      assert.equal(accounts.length, 1);
      assert.equal(users[0].passwordLoginEnabled, true);
    }
  });

  await t.test('a third-party email collision requires the original sign-in method', async () => {
    reset();
    claims.email = 'person@third-party.test';
    users.push(localUser({ email: claims.email }));
    await assert.rejects(() => AuthService.googleContinue(credential), { code: 'GOOGLE_LINK_REQUIRED' });
    assert.equal(accounts.length, 0);
    assert.equal(sessions.length, 0);
    assert.equal(users[0].emailVerified, false);
  });

  await t.test('Google sign-in preserves explicitly selected initials', async () => {
    reset();
    claims.picture = 'https://lh3.googleusercontent.com/fixture-photo';
    users.push(localUser({ image: 'Default' }));
    const result = await AuthService.googleContinue(credential);
    assert.equal(result.user.id, 'existing-user');
    assert.equal(users[0].image, 'Default');
  });

  await t.test('suspended users, pending invitations and mismatched subjects remain blocked', async () => {
    reset();
    users.push(localUser({ isSuspended: true }));
    await assert.rejects(() => AuthService.googleContinue(credential), /suspended/);
    reset();
    users.push(localUser({ role: 'NUTRITIONIST' }));
    application = { status: 'APPROVED' };
    await assert.rejects(() => AuthService.googleContinue(credential), /invitation/);
    reset();
    users.push(localUser());
    accounts.push({
      id: 'other-link',
      provider: 'google',
      providerAccountId: 'different-subject',
      userId: 'existing-user',
    });
    await assert.rejects(() => AuthService.googleContinue(credential), { code: 'GOOGLE_IDENTITY_MISMATCH' });
    assert.equal(sessions.length, 0);
  });

  await t.test('creation admission rejection prevents account and session writes', async () => {
    reset();
    await assert.rejects(
      () =>
        AuthService.googleContinue(credential, async () => {
          throw new Error('Limited');
        }),
      /Limited/
    );
    assert.equal(users.length, 0);
    assert.equal(sessions.length, 0);
  });

  await t.test(
    'HTTP continuation sets a private cookie and keeps returning users out of the creation budget',
    async () => {
      reset();
      const { default: router } = await import('../src/routes/auth.routes');
      const app = express();
      app.use(express.json());
      app.use('/api/auth', router);
      const server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const { port } = server.address() as AddressInfo;
      const request = (idToken = credential) =>
        fetch(`http://127.0.0.1:${port}/api/auth/google/continue`, {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      try {
        const response = await request();
        assert.equal(response.status, 200);
        assert.match(response.headers.get('set-cookie') ?? '', /nutrimind_refresh=.*HttpOnly/);
        const body = (await response.json()) as any;
        assert.equal(body.data.refreshToken, undefined);
        const returningClaims = { ...claims };
        const returningId = body.data.user.id;
        const allowance = process.env.NODE_ENV === 'development' ? 500 : 10;
        // The first creation consumed one slot; the next distinct identities consume the rest.
        for (let i = 1; i < allowance; i++) {
          claims = { email: `new-${i}@gmail.com`, sub: `sub-${i}`, email_verified: true };
          assert.equal((await request()).status, 200);
        }
        claims = { email: 'blocked@gmail.com', sub: 'blocked', email_verified: true };
        assert.equal((await request()).status, 429);
        assert.equal(users.length, allowance);
        claims = returningClaims;
        const returning = await request();
        assert.equal(returning.status, 200);
        assert.equal(((await returning.json()) as any).data.user.id, returningId);
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      }
    }
  );
});
