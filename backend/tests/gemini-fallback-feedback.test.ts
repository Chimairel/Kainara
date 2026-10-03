import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { GEMINI_MODEL_SEQUENCE } from '../src/domain/gemini-model.policy';
import { AppError } from '../src/errors/AppError';

test('Gemini SDK fallback preserves validation, quota stops and clear overload feedback without live provider calls', async (t) => {
  const priorKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'synthetic-no-provider-access';
  const events: Array<{ attempts: number; errorCode?: string; model?: string }> = [];
  const globals = globalThis as unknown as { prisma: unknown };
  const priorPrisma = globals.prisma;
  globals.prisma = {
    aiUsageEvent: {
      create: async (input: { data: (typeof events)[number] }) => {
        events.push(input.data);
        return {};
      },
    },
  };
  const { AiCapacityDeferredError, AiCapacityService } = await import('../src/services/ai-capacity.service');
  t.mock.method(AiCapacityService, 'finish', async () => undefined);
  let reservations = 0;
  let stopAfter = Infinity;
  t.mock.method(AiCapacityService, 'reserve', async () => {
    if (reservations >= stopAfter) {
      throw new AiCapacityDeferredError(
        'AI is busy right now. Please try again shortly.',
        new Date(Date.now() + 60_000)
      );
    }
    reservations += 1;
    return `synthetic-${reservations}`;
  });
  let mode: 'recover' | 'overload' | 'quota' | 'validation' = 'recover';
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: unknown) => {
    const model = /\/models\/([^:]+):generateContent/.exec(String(input))?.[1];
    assert.ok(model, 'Only synthetic generateContent transport is allowed.');
    calls.push(model);
    const status =
      mode === 'quota' ? 429 : mode === 'overload' || (mode === 'recover' && calls.length === 1) ? 503 : 200;
    const body =
      status === 200
        ? {
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: mode === 'validation' && calls.length === 1 ? '{"ok":false}' : '{"ok":true}' }],
                },
              },
            ],
          }
        : {
            error: {
              code: status,
              status: status === 429 ? 'RESOURCE_EXHAUSTED' : 'UNAVAILABLE',
              message: status === 429 ? 'quota exceeded' : 'This model is currently experiencing high demand.',
            },
          };
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });
  try {
    const { generateGenerativeJSON } = await import('../src/lib/gemini');
    const run = () =>
      generateGenerativeJSON('Return {"ok":true}.', undefined, z.object({ ok: z.literal(true) }), {
        operation: 'OUTSIDE_MEAL_ESTIMATE',
      });
    assert.deepEqual(await run(), { ok: true });
    assert.deepEqual(calls, GEMINI_MODEL_SEQUENCE.slice(0, 2));

    mode = 'overload';
    calls.length = 0;
    reservations = 0;
    await assert.rejects(
      run,
      (error: unknown) => error instanceof AppError && error.errorCode === 'AI_HIGH_DEMAND' && error.statusCode === 503
    );
    assert.deepEqual(calls, [...GEMINI_MODEL_SEQUENCE]);

    calls.length = 0;
    reservations = 0;
    stopAfter = 2;
    await assert.rejects(
      run,
      (error: unknown) => error instanceof AiCapacityDeferredError && error.errorCode === 'AI_HIGH_DEMAND'
    );
    assert.deepEqual(calls, GEMINI_MODEL_SEQUENCE.slice(0, 2));
    assert.equal(events.at(-1)?.attempts, 2);
    assert.equal(events.at(-1)?.model, GEMINI_MODEL_SEQUENCE[1]);

    mode = 'quota';
    calls.length = 0;
    reservations = 0;
    stopAfter = Infinity;
    await assert.rejects(
      run,
      (error: unknown) =>
        error instanceof AiCapacityDeferredError &&
        error.statusCode === 429 &&
        error.errorCode === 'AI_PROVIDER_RATE_LIMIT'
    );
    assert.deepEqual(calls, [GEMINI_MODEL_SEQUENCE[0]], 'Quota faults cannot spend additional fallback attempts.');
    assert.equal(
      events.at(-1)?.errorCode,
      'PROVIDER_QUOTA',
      'Existing project cooldown telemetry must remain compatible.'
    );

    mode = 'validation';
    calls.length = 0;
    reservations = 0;
    assert.deepEqual(await run(), { ok: true });
    assert.deepEqual(calls, GEMINI_MODEL_SEQUENCE.slice(0, 2), 'An invalid candidate is never accepted as a success.');
  } finally {
    globals.prisma = priorPrisma;
    if (priorKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = priorKey;
  }
});
