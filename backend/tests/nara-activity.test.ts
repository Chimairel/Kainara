import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import { NaraActivityService, naraActivityInput, naraActivityQuery } from '../src/services/nara-activity.service';
import { landingTextSchema } from '../src/domain/landing-media.policy';

test('submitted-message schema rejects context/drafts and framing rejects arbitrary CSS', () => {
  const input = { requestKey: randomUUID(), message: 'What is protein?' };
  assert(naraActivityInput.safeParse(input).success);
  for (const patch of [{ context: [] }, { password: 'secret' }, { message: 'x'.repeat(1001) }, { message: ' ' }])
    assert(!naraActivityInput.safeParse({ ...input, ...patch }).success);
  assert(!naraActivityQuery.safeParse({ search: 'x'.repeat(121) }).success);
  for (const framing of [
    { fit: 'cover', x: 101, y: 0 },
    { fit: 'url(evil)', x: 0, y: 0 },
  ])
    assert(!landingTextSchema.safeParse({ revision: 1, altText: 'Preview', framing }).success);
  assert(
    landingTextSchema.safeParse({ revision: 1, altText: 'Preview', framing: { fit: 'contain', x: 25, y: 75 } }).success
  );
});

test('records are idempotent, omit context, paginate with retention and audit administrator reads', async (t) => {
  const enabled = process.env.MEMBER_ASSISTANT_ENABLED;
  process.env.MEMBER_ASSISTANT_ENABLED = 'true';
  t.after(() => {
    if (enabled === undefined) delete process.env.MEMBER_ASSISTANT_ENABLED;
    else process.env.MEMBER_ASSISTANT_ENABLED = enabled;
  });
  const original = {
    create: prisma.assistantMessageLog.createMany,
    find: prisma.assistantMessageLog.findMany,
    purge: prisma.assistantMessageLog.deleteMany,
    audit: prisma.auditEvent.create,
  };
  let insert: any, query: any, purge: any, audit: any;
  prisma.assistantMessageLog.createMany = (async (value: unknown) => {
    insert = value;
    return { count: 1 };
  }) as typeof original.create;
  prisma.assistantMessageLog.findMany = (async (value: unknown) => {
    query = value;
    return Array.from({ length: 26 }, (_, index) => ({ id: `id-${index}` }));
  }) as unknown as typeof original.find;
  prisma.assistantMessageLog.deleteMany = (async (value: unknown) => {
    purge = value;
    return { count: 3 };
  }) as typeof original.purge;
  prisma.auditEvent.create = (async (value: unknown) => {
    audit = value;
    return {};
  }) as unknown as typeof original.audit;
  t.after(() => {
    prisma.assistantMessageLog.createMany = original.create;
    prisma.assistantMessageLog.findMany = original.find;
    prisma.assistantMessageLog.deleteMany = original.purge;
    prisma.auditEvent.create = original.audit;
  });
  const requestKey = randomUUID();
  await NaraActivityService.record('member', { requestKey, message: '/ai What is protein?' });
  assert.deepEqual(insert, {
    data: [{ userId: 'member', requestKey, message: '/ai What is protein?', mode: 'AI_REQUEST' }],
    skipDuplicates: true,
  });
  const now = new Date('2026-10-20T00:00:00Z');
  const result = await NaraActivityService.list('admin', { search: 'protein', cursor: 'last-page' }, now);
  assert.equal(result.items.length, 25);
  assert.equal(result.nextCursor, 'id-24');
  assert.deepEqual(query.cursor, { id: 'last-page' });
  assert.equal(query.skip, 1);
  assert.equal(query.where.createdAt.gte.toISOString(), '2026-09-20T00:00:00.000Z');
  assert.equal(query.select.user.select.email, true);
  assert.equal(query.select.context, undefined);
  assert.equal(audit.data.actorUserId, 'admin');
  assert.equal(audit.data.action, 'NARA_ACTIVITY_VIEWED');
  assert(!JSON.stringify(audit).includes('protein'));
  await NaraActivityService.purgeExpired(now);
  assert.equal(purge.where.createdAt.lt.toISOString(), '2026-09-20T00:00:00.000Z');
});
