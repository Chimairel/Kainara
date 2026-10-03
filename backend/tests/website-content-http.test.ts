import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import prisma from '../src/lib/prisma';
import authenticate from '../src/middleware/auth';
import requireRole from '../src/middleware/rbac';
import { signAccessToken } from '../src/lib/jwt';
import adminRouter from '../src/routes/admin-website-content.routes';
import publicRouter from '../src/routes/public-website-content.routes';
import { WebsiteContentService } from '../src/services/website-content.service';

process.env.JWT_SECRET ||= 'synthetic-website-access-secret';
test('public delivery exposes only published data; mutation requires a live ADMIN session', async (context) => {
  let role: 'ADMIN' | 'NUTRITIONIST' | 'USER' = 'ADMIN';
  const original = prisma.user.findUnique;
  prisma.user.findUnique = (async () => ({
    email: 'fixture@example.invalid',
    role,
    isSuspended: false,
  })) as unknown as typeof original;
  context.after(() => {
    prisma.user.findUnique = original;
  });
  context.mock.method(WebsiteContentService, 'getPublic', async () => ({
    kind: 'image',
    url: 'https://res.cloudinary.com/test/image/upload/promo.jpg',
    posterUrl: null,
    altText: 'Published',
  }));
  context.mock.method(WebsiteContentService, 'getAdmin', async () => ({
    revision: 0,
    draft: null,
    published: null,
    publishedAt: null,
  }));
  const app = express();
  app.use(express.json());
  app.use('/api/admin/website-content', authenticate, requireRole('ADMIN'), adminRouter);
  app.use('/api/public', publicRouter);
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve) => server.on('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const publicResponse = await fetch(`${base}/api/public/landing-media`);
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get('cache-control'), 'public, max-age=60');
  const result = (await publicResponse.json()) as { data: Record<string, unknown> };
  assert.equal('draft' in result.data, false);
  assert.equal('publicId' in result.data, false);
  assert.equal((await fetch(`${base}/api/admin/website-content`)).status, 401);
  const authorization = `Bearer ${signAccessToken({ userId: 'fixture-admin', email: 'fixture@example.invalid', role: 'ADMIN' })}`;
  for (const denied of ['USER', 'NUTRITIONIST'] as const) {
    role = denied;
    assert.equal(
      (
        await fetch(`${base}/api/admin/website-content/reset`, {
          method: 'POST',
          headers: { authorization, 'Content-Type': 'application/json' },
          body: '{"revision":0}',
        })
      ).status,
      403
    );
  }
  role = 'ADMIN';
  assert.equal((await fetch(`${base}/api/admin/website-content`, { headers: { authorization } })).status, 200);
  const invalid = await fetch(`${base}/api/admin/website-content/publish`, {
    method: 'POST',
    headers: { authorization, 'Content-Type': 'application/json' },
    body: '{"revision":-1}',
  });
  assert.equal(invalid.status, 400);
  const file = new FormData();
  file.append('revision', '0');
  file.append('slot', 'asset');
  file.append('file', new Blob(['text'], { type: 'text/html' }), 'fake.mp4');
  assert.equal(
    (
      await fetch(`${base}/api/admin/website-content/upload`, {
        method: 'POST',
        headers: { authorization },
        body: file,
      })
    ).status,
    400
  );
});
