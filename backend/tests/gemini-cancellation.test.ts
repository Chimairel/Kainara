import assert from 'node:assert/strict';
import test from 'node:test';

test('worker cancellation stops provider fallback and releases its reservation after the request settles', async (context) => {
  const priorKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'synthetic-no-live-provider';
  const shared = globalThis as unknown as { prisma: unknown };
  const previous = shared.prisma;
  shared.prisma = { aiUsageEvent: { create: async () => ({}) } };
  context.after(() => {
    shared.prisma = previous;
    if (priorKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = priorKey;
  });
  const controller = new AbortController();
  const { AiCapacityService } = await import('../src/services/ai-capacity.service');
  const reservation = context.mock.method(AiCapacityService, 'reserve', async () => 'synthetic-reservation');
  const finish = context.mock.method(AiCapacityService, 'finish', async () => undefined);
  const transport = context.mock.method(globalThis, 'fetch', async () => {
    controller.abort();
    assert.equal(finish.mock.callCount(), 0, 'keep capacity reserved while the provider request is in flight');
    return new Response(JSON.stringify({ error: { code: 503, message: 'synthetic overload' } }), { status: 503 });
  });
  const { generateGenerativeJSON } = await import('../src/lib/gemini');
  await assert.rejects(() =>
    generateGenerativeJSON('Synthetic request', undefined, undefined, { signal: controller.signal })
  );
  assert.equal(transport.mock.callCount(), 1);
  assert.equal(reservation.mock.callCount(), 1);
  assert.equal(finish.mock.callCount(), 1);

  const whileWaiting = new AbortController();
  context.mock.method(AiCapacityService, 'reserve', async () => {
    whileWaiting.abort();
    return 'second-reservation';
  });
  await assert.rejects(() =>
    generateGenerativeJSON('Synthetic request', undefined, undefined, { signal: whileWaiting.signal })
  );
  assert.equal(transport.mock.callCount(), 1, 'cancellation during admission prevents sending the request');
  assert.equal(finish.mock.callCount(), 2);
});
