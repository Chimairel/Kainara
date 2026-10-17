/** Fresh loopback-only HTTP/SQL check. Never accepts shared or hosted targets. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { writeFileSync } from 'node:fs';

async function main() {
  const target = new URL(process.env.DATABASE_URL!);
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55432');
  assert.match(target.pathname, /^\/kainara_nara_[a-f0-9]{8}$/);
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.GEMINI_API_KEY ?? '', '');
  const { default: db } = await import('../src/lib/prisma');
  const { default: app } = await import('../src/app');
  const { signAccessToken } = await import('../src/lib/jwt');
  const { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } = await import('../src/domain/onboarding.policy');
  const { NaraAnswerService } = await import('../src/services/nara-answer.service');
  assert.equal(await db.user.count(), 0);
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    assert.equal(new URL(String(input)).hostname, '127.0.0.1', 'No external provider calls');
    return nativeFetch(input, init);
  };
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    const actors = await Promise.all(
      (['ADMIN', 'NUTRITIONIST', 'USER'] as const).map((role) =>
        db.user.create({
          data: {
            email: `nara-${role.toLowerCase()}@example.invalid`,
            name: `Synthetic ${role}`,
            passwordHash: 'not-a-valid-login-hash',
            role,
            emailVerified: true,
            onboardingDone: true,
            tosAccepted: true,
            acceptedTermsVersion: CURRENT_TERMS_VERSION,
            acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
          },
        })
      )
    );
    const [admin, rnd, member] = actors;
    const tokens = new Map(
      actors.map((actor) => [actor.id, signAccessToken({ userId: actor.id, email: actor.email, role: actor.role })])
    );
    const call = async (actor: typeof admin | null, path: string, body?: unknown, method?: string) => {
      const response = await fetch(base + path, {
        method: method ?? (body ? 'POST' : 'GET'),
        headers: {
          'Content-Type': 'application/json',
          ...(actor ? { Authorization: 'Bearer ' + tokens.get(actor.id) } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: (await response.json()) as any };
    };
    const route = '/admin/nara-answers';
    for (const actor of [null, member, rnd]) {
      const expected = actor ? 403 : 401;
      assert.equal((await call(actor, route)).status, expected);
      assert.equal((await call(actor, route, {})).status, expected);
      assert.equal((await call(actor, route + '/nara-answer-fake/publish', { revision: 0 })).status, expected);
    }
    const draft = {
      question: 'Why does KAINARA need a weekly weight log?',
      variants: ['Bakit kailangan ng KAINARA ang timbang bawat linggo?'],
      answer: 'Keep recorded planning information current.',
      category: 'APP_HELP' as const,
    };
    const created = await call(admin, route, draft);
    assert.equal(created.status, 201);
    let entry = created.body.data;
    assert.equal((await call(member, '/user/assistant')).body.data.instantQuestions.length, 0, 'Draft never exposed');
    await db.assistantRequest.createMany({
      data: Array.from({ length: 5 }, () => ({
        userId: member.id,
        requestKey: randomUUID(),
        payloadHash: 'a'.repeat(64),
        state: 'SUCCEEDED',
        leaseUntil: new Date(),
        completedAt: new Date(),
      })),
    });
    const beforeUsage = await db.assistantRequest.count();
    const published = await call(admin, `${route}/${entry.id}/publish`, { revision: entry.revision });
    assert.equal(published.status, 200);
    entry = published.body.data;
    const questionIndex = (await call(member, '/user/assistant')).body.data;
    assert.equal(questionIndex.instantQuestions.length, 2);
    assert(!JSON.stringify(questionIndex).includes(draft.answer));
    assert.equal(questionIndex.allowance.remaining, 0);
    assert(questionIndex.allowance.nextAiRequestAt);
    const reply = await call(member, '/user/assistant/messages', {
      requestKey: randomUUID(),
      message: draft.variants[0].toUpperCase(),
      allowAi: false,
    });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.data.reply.text, draft.answer);
    assert.equal(reply.body.data.reply.creditsUsed, 0);
    const stale = await call(admin, `${route}/${entry.id}`, { revision: 1, draft }, 'PATCH');
    assert.equal(stale.status, 409);
    const edited = await call(
      admin,
      `${route}/${entry.id}`,
      { revision: entry.revision, draft: { ...draft, answer: 'A revised saved answer.' } },
      'PATCH'
    );
    assert.equal(edited.status, 200);
    entry = edited.body.data;
    assert.equal(
      (await NaraAnswerService.reply(draft.question))?.text,
      draft.answer,
      'Editing draft preserves published text'
    );
    const republished = await call(admin, `${route}/${entry.id}/publish`, { revision: entry.revision });
    assert.equal(republished.status, 200);
    entry = republished.body.data;
    assert.equal((await NaraAnswerService.reply(draft.question))?.text, 'A revised saved answer.');
    const ai = await call(member, '/user/assistant/messages', {
      requestKey: randomUUID(),
      message: '/ai ' + draft.question,
      allowAi: false,
    });
    assert.equal(ai.status, 200);
    assert.equal(ai.body.data.confirmationRequired, true);
    assert.equal(
      await db.assistantRequest.count(),
      beforeUsage,
      'Neither instant answer nor preflight reserves credits'
    );
    assert.equal(
      (await call(admin, route, { ...draft, question: 'Can I eat taho if I have diabetes?', variants: [] })).status,
      400
    );
    const unpublished = await call(admin, `${route}/${entry.id}/unpublish`, { revision: entry.revision });
    assert.equal(unpublished.status, 200);
    entry = unpublished.body.data;
    assert.equal(await NaraAnswerService.reply(draft.question), null);
    const second = (await call(admin, route, draft)).body.data;
    const concurrent = await Promise.all(
      [entry, second].map((row) => call(admin, `${route}/${row.id}/publish`, { revision: row.revision }))
    );
    assert.deepEqual(
      concurrent.map((result) => result.status).sort(),
      [200, 409],
      'Concurrent duplicate questions cannot both publish'
    );
    const current = (await call(admin, route)).body.data as Array<{ id: string; revision: number }>;
    for (const row of current)
      assert.equal((await call(admin, `${route}/${row.id}/delete`, { revision: row.revision })).status, 200);
    assert.equal((await NaraAnswerService.questions()).length, 0);
    assert.equal(await db.websiteContent.count(), 0);
    assert((await db.auditEvent.count({ where: { action: { startsWith: 'NARA_ANSWER_' } } })) >= 9);
    const receipt = {
      at: new Date().toISOString(),
      localOnly: true,
      adminRoles: true,
      draftsPrivate: true,
      publishEditUnpublishDelete: true,
      staleRevisions: true,
      concurrentDuplicateBlocked: true,
      multilingualExactMatch: true,
      aiBypassRetained: true,
      creditReservations: 0,
      providerCalls: 0,
    };
    if (process.env.NARA_ACCEPTANCE_RECEIPT)
      writeFileSync(process.env.NARA_ACCEPTANCE_RECEIPT, JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.$disconnect();
    globalThis.fetch = nativeFetch;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
