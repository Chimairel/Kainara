/** Real HTTP probes against an explicitly disposable local database. No provider mocks. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';

export const password = 'SyntheticSystemAudit123!';
export const directory = path.resolve('../.codex-runtime/system-audit');
export type Fixture = { id: string; email: string; token: string; reviewerId?: string };
export type AuditState = {
  fixtures: Record<string, Fixture>;
  results: Array<{ batch: string; name: string; pass: boolean; detail?: unknown }>;
};

export async function harness(batch: string) {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55478');
  assert.equal(target.pathname, '/kainara_system_audit');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.MEMBERSHIP_ENABLED, 'true');
  assert.equal(process.env.GEMINI_API_KEY || '', '');
  await mkdir(directory, { recursive: true });
  process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = path.join(directory, 'mail.jsonl');
  const statePath = path.join(directory, 'state.json');
  const state: AuditState = await readFile(statePath, 'utf8')
    .then(JSON.parse)
    .catch(() => ({ fixtures: {}, results: [] }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  async function request(route: string, method = 'GET', body?: unknown, token?: string, cookie?: string) {
    const response = await fetch(base + route, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw: raw.slice(0, 200) };
    }
    return {
      status: response.status,
      body: data,
      cookie: response.headers
        .getSetCookie()
        .map((row) => row.split(';')[0])
        .join('; '),
      headers: response.headers,
    };
  }
  async function check(name: string, probe: () => Promise<unknown>) {
    try {
      const detail = await probe();
      state.results.push({ batch, name, pass: true, detail });
      console.log('PASS', name, JSON.stringify(detail ?? null));
    } catch (error: any) {
      process.exitCode = 1;
      state.results.push({ batch, name, pass: false, detail: { message: error.message, code: error.errorCode } });
      console.log('FAIL', name, error.message);
    }
    await writeFile(statePath, JSON.stringify(state, null, 2));
  }
  async function login(key: string) {
    const fixture = state.fixtures[key];
    assert.ok(fixture, key);
    const response = await request('/api/auth/login', 'POST', { email: fixture.email, password });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    fixture.token = response.body.data.accessToken;
    return response;
  }
  async function staff(key: string, role: 'ADMIN' | 'NUTRITIONIST', verified = true) {
    if (!state.fixtures[key]) {
      const user = await prisma.user.create({
        data: {
          name: `Synthetic Audit ${key}`,
          email: `system-audit-${key}@example.invalid`,
          role,
          passwordHash: await bcrypt.hash(password, 12),
          emailVerified: true,
          ...(role === 'NUTRITIONIST'
            ? {
                nutritionistProfile: {
                  create: {
                    prcLicenseNumber: `SYNTHETIC-${key.toUpperCase()}`,
                    prcLicenseExpiry: new Date('2099-12-31'),
                    isVerified: verified,
                    bio: 'Isolated software fixture. Not a clinician or clinical validation.',
                  },
                },
              }
            : {}),
        },
        include: { nutritionistProfile: true },
      });
      state.fixtures[key] = { id: user.id, email: user.email, token: '', reviewerId: user.nutritionistProfile?.id };
    }
    await login(key);
    await writeFile(statePath, JSON.stringify(state, null, 2));
    return state.fixtures[key];
  }
  async function mails(email: string, type: string) {
    return (await readFile(process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH!, 'utf8'))
      .trim()
      .split('\n')
      .map((row) => JSON.parse(row))
      .filter((row: any) => row.to === email && row.type === type);
  }
  return {
    batch,
    base,
    state,
    request,
    check,
    login,
    staff,
    mails,
    async close() {
      await writeFile(statePath, JSON.stringify(state, null, 2));
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await prisma.$disconnect();
    },
  };
}
