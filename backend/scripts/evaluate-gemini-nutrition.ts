import { config } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import {
  buildGeminiGenerationConfig,
  GEMINI_MODEL_SEQUENCE,
  GEMINI_MODEL_TIMEOUT_MS,
} from '../src/domain/gemini-model.policy';
import { buildOutsideMealAiSchema } from '../src/domain/outside-meal-ai.policy';
import { memberSafeGeminiError } from '../src/domain/gemini-error.policy';
import { loadNutritionReferenceCases, measureNutritionEstimates } from './helpers/gemini-nutrition-evaluation';

/** Explicit diagnostic: synthetic public food descriptions only, no Prisma imports or database writes.
 * One batch per model, no retries; pace requests below the default two/minute limit.
 * This spends up to four provider requests outside application telemetry. */
async function main() {
  const data = loadNutritionReferenceCases(resolve(__dirname, '../prisma/data/fnri.csv'));
  if (!process.argv.includes('--live')) {
    console.log(JSON.stringify({ mode: 'references-only', cases: data.cases, providerRequests: 0 }, null, 2));
    return;
  }
  config({ path: resolve(__dirname, '../.env'), quiet: true });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required for an explicitly requested live evaluation.');
  const provider = new GoogleGenerativeAI(apiKey);
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new Error('An output path is required after --output.');
  const timestamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const output =
    outputIndex >= 0
      ? resolve(process.argv[outputIndex + 1])
      : resolve(__dirname, `../../docs/verification/gemini-nutrition-${timestamp}.json`);
  const results: Array<Record<string, unknown>> = [];
  const report = {
    startedAt: new Date().toISOString(),
    protocol:
      'One shared outside-food production prompt per model; eight weighed FNRI portions. Reference answers withheld.',
    limitations:
      'Small exploratory sample; not a clinical validation or uptime ranking. No photos, ambiguous portions or complex restricted-meal generation assessed.',
    referencePath: 'backend/prisma/data/fnri.csv',
    referenceSha256: data.referenceSha256,
    promptSha256: data.promptSha256,
    providerTimeoutMs: GEMINI_MODEL_TIMEOUT_MS,
    minimumRequestIntervalMs: 35_000,
    results,
  };
  mkdirSync(dirname(output), { recursive: true });
  let previousStart = 0;
  for (const modelName of GEMINI_MODEL_SEQUENCE) {
    await pause(Math.max(0, previousStart + 35_000 - Date.now()));
    previousStart = Date.now();
    console.log(`Evaluating ${modelName} on ${data.cases.length} public reference portions.`);
    try {
      const model = provider.getGenerativeModel(
        { model: modelName, systemInstruction: data.request.systemInstruction },
        { timeout: GEMINI_MODEL_TIMEOUT_MS }
      );
      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: data.request.prompt }] }],
        generationConfig: buildGeminiGenerationConfig(),
      });
      const text = response.response
        .text()
        .trim()
        .replace(/^```(?:json)?\s*/iu, '')
        .replace(/\s*```$/u, '');
      const parsed = buildOutsideMealAiSchema(data.cases.length).safeParse(JSON.parse(text));
      if (!parsed.success) throw new Error('Response validation failed.');
      const measurement = measureNutritionEstimates(data.cases, parsed.data.items);
      results.push({ model: modelName, status: 'success', latencyMs: Date.now() - previousStart, ...measurement });
      console.log(
        JSON.stringify({
          model: modelName,
          meanAbsoluteErrors: measurement.meanAbsoluteErrors,
          caloriePercentError: measurement.meanAbsoluteCaloriePercentError,
        })
      );
    } catch (cause) {
      const error = memberSafeGeminiError(cause);
      const quota = (cause as { status?: number })?.status === 429;
      results.push({
        model: modelName,
        status: 'failed',
        latencyMs: Date.now() - previousStart,
        errorCode: quota ? 'AI_PROVIDER_RATE_LIMIT' : error.errorCode,
      });
      console.log(JSON.stringify(results.at(-1)));
      writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
      if (quota) break;
    }
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(`Saved ${results.length} diagnostic attempts to ${output}.`);
}

main().catch(() => {
  console.error('Nutrition evaluation could not complete. Check the reference file and local API configuration.');
  process.exitCode = 1;
});
