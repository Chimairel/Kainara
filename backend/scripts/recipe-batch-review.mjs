/* global fetch, AbortSignal */
import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const mode = process.argv[2];
const api = option('api')?.replace(/\/$/, '');
const file = option('file');
const token = process.env.KAINARA_REVIEW_TOKEN;
if (!['export', 'submit'].includes(mode) || !api || !file || !token) {
  throw new Error(
    'Use export|submit --api=http://localhost:5000/api --file=PATH with KAINARA_REVIEW_TOKEN set privately.'
  );
}
const url = new URL(api);
if (
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  !url.pathname.endsWith('/api') ||
  !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
) {
  throw new Error('Use an HTTPS API base, or loopback HTTP, ending in /api.');
}
async function request(path, body) {
  const response = await fetch(`${api}/nutritionist/recipe-batch-review/${path}`, {
    method: body ? 'POST' : 'GET',
    redirect: 'error',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok)
    throw new Error(
      `Review API returned ${response.status}. Check login, eligibility and API settings; no automatic retry was sent.`
    );
  const json = await response.json();
  if (!json.success) throw new Error('The review API did not confirm success.');
  return json.data;
}

if (mode === 'export') {
  mkdirSync(dirname(resolve(file)), { recursive: true });
  const items = [],
    cursors = new Set();
  let cursor;
  let environmentKey;
  do {
    const page = await request(`preview${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
    if (!/^[a-f0-9]{64}$/.test(page.environmentKey) || (environmentKey && environmentKey !== page.environmentKey))
      throw new Error('The API database target changed during export. Start a new export.');
    environmentKey = page.environmentKey;
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor && cursors.has(cursor)) throw new Error('Repeated export cursor; stopped.');
    if (cursor) cursors.add(cursor);
    if (items.length > 20_000) throw new Error('Export exceeds the operator review limit.');
  } while (cursor);
  writeFileSync(
    resolve(file),
    JSON.stringify(
      {
        format: 'KAINARA_RECIPE_REVIEW_V1',
        api,
        environmentKey,
        exportedAt: new Date().toISOString(),
        confirmedReview: false,
        items,
      },
      null,
      2
    ),
    { flag: 'wx', mode: 0o600 }
  );
  console.log(
    `Exported ${items.length} recipes; ${items.filter((item) => item.issues.length).length} need evidence corrections. No reviews recorded.`
  );
} else {
  if (!process.argv.includes('--confirm-reviewed'))
    throw new Error('Submission requires --confirm-reviewed after reviewing the exported evidence.');
  const report = JSON.parse(readFileSync(resolve(file), 'utf8'));
  if (
    report.format !== 'KAINARA_RECIPE_REVIEW_V1' ||
    report.api !== api ||
    report.confirmedReview !== true ||
    !/^[a-f0-9]{64}$/.test(report.environmentKey || '') ||
    !Array.isArray(report.items)
  ) {
    throw new Error('Review file must match this API and explicitly confirm the review.');
  }
  const selected = report.items.filter((item) => item.reviewed === true);
  if (!selected.length || new Set(selected.map((item) => item.id)).size !== selected.length)
    throw new Error('Select at least one recipe, with no duplicates.');
  if (
    selected.some(
      (item) => item.issues?.length || typeof item.rationale !== 'string' || item.rationale.trim().length < 10
    )
  ) {
    throw new Error('Correct evidence issues and provide a rationale for every selected recipe.');
  }
  const results = [];
  for (let start = 0; start < selected.length; start += 5) {
    const items = selected
      .slice(start, start + 5)
      .map(({ id, revisionKey, evidenceHash, rationale }) => ({ id, revisionKey, evidenceHash, rationale }));
    const response = await request('confirm', { confirmedReview: true, environmentKey: report.environmentKey, items });
    results.push(...response.results);
    // Preserve partial receipts after every response; retries retain existing reviewer attribution.
    writeFileSync(`${resolve(file)}.receipts.json`, JSON.stringify({ api, results }, null, 2), { mode: 0o600 });
    if (response.results.some((item) => item.status === 'FAILED')) {
      console.log(
        'Stopped at a failed item. See the private receipts file; earlier successful reviews remain recorded.'
      );
      process.exitCode = 1;
      break;
    }
  }
  console.log(
    `Recorded ${results.filter((item) => item.status === 'VERIFIED').length}; already reviewed ${results.filter((item) => item.status === 'ALREADY_VERIFIED').length}; failed ${results.filter((item) => item.status === 'FAILED').length}.`
  );
}
