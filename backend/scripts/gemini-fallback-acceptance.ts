import 'dotenv/config';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { GEMINI_MODEL_SEQUENCE } from '../src/domain/gemini-model.policy';

async function main() {
  const databaseHost = new URL(process.env.DATABASE_URL ?? '').hostname;
  if (!['localhost', '127.0.0.1'].includes(databaseHost) ||
      process.env.GEMINI_FALLBACK_DISPOSABLE_DB !== '1') {
    throw new Error('Run the Gemini fallback acceptance only in a disposable local database.');
  }
  // The SDK still constructs the real provider request. Only its transport is
  // replaced, so this acceptance cannot spend API quota or send patient data.
  process.env.GEMINI_API_KEY = 'isolated-provider-fixture';
  process.env.GEMINI_PROJECT_MAX_RPM = '10';
  process.env.GEMINI_PROJECT_MAX_ESTIMATED_TPM = '100000';
  process.env.GEMINI_PROJECT_MAX_IN_FLIGHT = '1';
  const originalFetch = globalThis.fetch;
  const attemptedModels: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    const model = /\/models\/([^:]+):generateContent/.exec(url)?.[1];
    assert.ok(model, `Unexpected Gemini request: ${url}`);
    attemptedModels.push(model);
    if (attemptedModels.length < GEMINI_MODEL_SEQUENCE.length) {
      return new Response(JSON.stringify({ error: {
        code: 503, message: 'Synthetic provider unavailable', status: 'UNAVAILABLE',
      } }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ candidates: [{ content: {
      role: 'model', parts: [{ text: '{"ok":true}' }],
    } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const { generateGenerativeJSON } = await import('../src/lib/gemini');
    const { AiCapacityDeferredError } = await import('../src/services/ai-capacity.service');
    const result = await generateGenerativeJSON('Return {"ok":true}.', undefined,
      z.object({ ok: z.literal(true) }), { purpose: 'LOCAL_FALLBACK_ACCEPTANCE' });
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(attemptedModels, [...GEMINI_MODEL_SEQUENCE]);
    const quotaModels: string[] = [];
    globalThis.fetch = async (input) => {
      const model = /\/models\/([^:]+):generateContent/.exec(String(input))?.[1];
      assert.ok(model);
      quotaModels.push(model);
      return new Response(JSON.stringify({ error: {
        code: 429, message: 'Synthetic project quota exceeded', status: 'RESOURCE_EXHAUSTED',
      } }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    };
    await assert.rejects(generateGenerativeJSON('Return {"ok":true}.', undefined,
      z.object({ ok: z.literal(true) }), { purpose: 'LOCAL_QUOTA_ACCEPTANCE' }),
    AiCapacityDeferredError);
    assert.deepEqual(quotaModels, [GEMINI_MODEL_SEQUENCE[0]],
      'A project quota fault should stop the cascade after one provider attempt.');
    console.log(JSON.stringify({ passed: true, attemptedModels, quotaModels }));
  } finally {
    globalThis.fetch = originalFetch;
    const { default: prisma } = await import('../src/lib/prisma');
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
