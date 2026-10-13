/** One admin-authored meal, real HTTP routes and SQL; fresh owned loopback database only. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { parse } from 'dotenv';

async function main() {
  const root = resolve(__dirname, '../..');
  const container = 'kainara-local-postgres';
  const docker = (args: string[], input?: string) => execFileSync('docker', args, {
    encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
  });
  const inspected = JSON.parse(docker(['inspect', container]))[0];
  assert.equal(inspected.Config.Labels['com.docker.compose.project'], 'kainara-local-development');
  assert.deepEqual(inspected.HostConfig.PortBindings['5432/tcp'], [{ HostIp: '127.0.0.1', HostPort: '55432' }]);
  const database = `kainara_single_meal_${randomBytes(4).toString('hex')}`;
  const password = parse(readFileSync(resolve(root, 'backend/.local/local-development/postgres.env'))).LOCAL_POSTGRES_PASSWORD;
  assert.ok(typeof password === 'string' && /^[a-f0-9]{64}$/.test(password), 'Owned loopback password material is invalid.');
  const url = `postgresql://postgres:${password}@127.0.0.1:55432/${database}?schema=public`;
  Object.assign(process.env, {
    DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: 'test',
    JWT_SECRET: randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    SMTP_VERIFY_ON_STARTUP: 'false', MEMBERSHIP_ENABLED: 'false',
  });
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'SMTP_PASS', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY', 'GOOGLE_CLIENT_ID']) delete process.env[key];
  docker(['exec', container, 'createdb', '-U', 'postgres', database]);
  const ddl = execFileSync(process.execPath, [resolve(root, 'backend/node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', resolve(root, 'backend/prisma/schema.prisma'), '--script'], {
    cwd: resolve(root, 'backend'), env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
  });
  docker(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], ddl);
  const { default: db } = await import('../src/lib/prisma');
  const { default: app } = await import('../src/app');
  const { signAccessToken } = await import('../src/lib/jwt');
  const { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } = await import('../src/domain/onboarding.policy');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const evidence = resolve(root, 'backend/.local/single-meal-lifecycle', database);
  mkdirSync(evidence, { recursive: true });
  const checks: string[] = [];
  const { chromium, expect } = createRequire(resolve(root, 'frontend/package.json'))('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  const browserContexts: any[] = [];
  const passed = (check: string) => { checks.push(check); console.log(`PASS: ${check}`); };
  const account = async (name: string, role: 'ADMIN' | 'NUTRITIONIST' | 'USER') => {
    const user = await db.user.create({ data: {
      name: `Synthetic ${name}`, role, email: `${name.toLowerCase().replace(/ /g, '-')}@example.invalid`,
      passwordHash: 'unusable-isolated-fixture', emailVerified: true, onboardingDone: true, tosAccepted: true,
      acceptedTermsVersion: CURRENT_TERMS_VERSION, acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
    } });
    const token = signAccessToken({ userId: user.id, email: user.email, role });
    const profile = role === 'NUTRITIONIST' ? await db.nutritionistProfile.create({ data: {
      userId: user.id, isVerified: true, prcLicenseNumber: `${database}-${name}`, prcLicenseExpiry: new Date('2099-01-01'),
    } }) : null;
    return { user, token, profile };
  };
  type Actor = Awaited<ReturnType<typeof account>>;
  const pageFor = async (actor: Actor, path: string) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    browserContexts.push(context);
    await context.addCookies([{ name: 'nutrimind_session', value: actor.token, domain: 'localhost', path: '/' }]);
    await context.route('**/api/**', async (route: any) => {
      const incoming = new URL(route.request().url());
      if (incoming.pathname.includes('/live/')) return route.abort();
      // Every browser API request is forwarded to the real isolated server. Never fall through to hosted API.
      const response = await route.fetch({ url: base.replace(/\/api$/, '') + incoming.pathname + incoming.search });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(25_000);
    page.on('pageerror', (error: Error) => { throw error; });
    await page.goto('http://localhost:3000' + path);
    return page;
  };
  const request = async (actor: Actor, path: string, method = 'GET', body?: unknown, expected = 200) => {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${actor.token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json() as any;
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(result)}`);
    if (expected < 300) assert.equal(result.success, true);
    return expected < 300 ? result.data : result;
  };
  try {
    const admin = await account('Admin', 'ADMIN');
    const verifier = await account('Original Verifier', 'NUTRITIONIST');
    const flagger = await account('Flagger', 'NUTRITIONIST');
    const independent = await account('Independent Reviewer', 'NUTRITIONIST');
    const competing = await account('Competing Reviewer', 'NUTRITIONIST');
    const member = await account('Member', 'USER');
    await db.userProfile.create({ data: { userId: member.user.id, age: 26, biologicalSex: 'MALE', heightCm: 170, weightKg: 65, targetWeightKg: 65,
      goal: 'MAINTAIN', activityLevel: 'SEDENTARY', dietaryPreference: 'OMNIVORE', foodCulture: 'Filipino',
      shoppingDayGroup: 'WEEKEND', shoppingDayOfWeek: 0, dailyCalorieTarget: 2000,
    } });
    await db.safetyProfileEntry.createMany({ data: (['CONDITION', 'ALLERGY'] as const).map(domain => ({
      userId: member.user.id, domain, canonicalCode: 'NONE', displayName: 'None', originalText: 'None', normalizedText: 'none',
      provenance: 'PREDEFINED', supportState: 'SUPPORTED', policyReference: 'SYNTHETIC_FIXTURE',
    })) });
    await db.nutritionReport.create({ data: { userId: member.user.id, acknowledgedAt: new Date(), profileRevision: 0,
      foodsToAvoid: [], foodsToLimit: [], foodsRecommended: [], drinksGuidance: [],
      basedOnConditions: [], basedOnAllergies: [], generalSummary: 'Synthetic accepted report for isolated testing only.',
    } });
    const food = await db.foodItem.create({ data: {
      name: 'Synthetic measured squash', category: 'Vegetables', source: 'FNRI', compositionRevision: 1,
      calories: 130, proteinG: 2, carbsG: 29, fatG: 0.5, fiber: 2, sodium: 10, potassium: 100,
    } });
    const meal = await request(admin, '/admin/meals', 'POST', {
      mealName: 'Synthetic Lifecycle Squash', mealType: 'LUNCH', summary: 'Synthetic squash dish for lifecycle acceptance only.',
      instructions: 'Steam the measured squash until tender. Serve one measured portion.',
      nutritionBasis: 'Synthetic composition fixture, measured edible grams.', nutritionServingDescription: '100 g measured serving',
      calories: 130, proteinG: 2, carbsG: 29, fatG: 0.5, sodiumMg: 10, sugarG: 2, fiberG: 2,
      potassiumMg: 100, phosphorusMg: 20, saturatedFatG: 0.1,
      ingredients: [{ foodItemId: food.id, gramsPerServing: 100 }],
    }, 201);
    assert.equal(await db.mealLibrary.count(), 1);
    assert.equal((await request(verifier, '/nutritionist/library')).total, 0);
    passed('Admin creates exactly one meal; unverified draft is absent from Verified');
    await request(verifier, `/nutritionist/meal-verification/LIBRARY_MEAL/${meal.id}/claim`, 'POST');
    await request(verifier, `/nutritionist/meal-verification/LIBRARY_MEAL/${meal.id}/decision`, 'POST', {
      decision: 'VERIFIED', rationale: 'Synthetic base dish identity and recipe preparation verified.',
    });
    assert.equal((await request(verifier, '/nutritionist/library')).meals[0].id, meal.id);
    assert.equal((await request(member, '/user/meals/verified-recipes')).items[0].id, meal.id);
    passed('Original RND verifies through guarded routes and the meal appears in Verified');
    const detail = (actor: Actor = independent) => request(actor, `/nutritionist/meal-review-cases/${meal.id}`);
    const notes = {
      category: 'NUTRITION', affectedFields: ['sodiumMg'],
      explanation: 'Synthetic sodium evidence needs an independent documented check.',
      reference: 'Synthetic measured squash composition fixture revision one.',
      proposedCorrection: 'Check measured edible grams and sodium before republication.',
    };
    const flag = async () => request(flagger, `/nutritionist/library/${meal.id}/flag`, 'POST', { expectedVersion: (await detail()).recipeVersion, notes });
    const flaggerPage = await pageFor(flagger, `/nutritionist/library?mealId=${meal.id}`);
    await flaggerPage.getByRole('button', { name: 'Flag meal', exact: true }).click();
    const dialog = flaggerPage.getByRole('dialog', { name: 'Flag meal', exact: true });
    await dialog.getByLabel('Affected ingredients or nutrition fields').fill('sodiumMg');
    await dialog.getByLabel('Explanation', { exact: true }).fill(notes.explanation);
    await dialog.getByLabel('Supporting evidence or reference').fill(notes.reference);
    await dialog.getByLabel('Proposed correction').fill(notes.proposedCorrection);
    const flaggedResponse = flaggerPage.waitForResponse((response: any) => response.url().endsWith(`/library/${meal.id}/flag`) && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Flag and withhold meal', exact: true }).click();
    const firstFlag = await flaggedResponse;
    assert.equal(firstFlag.status(), 200);
    assert.equal((await firstFlag.json()).data.reviewState, 'PENDING_REREVIEW');
    assert.equal((await request(verifier, '/nutritionist/library')).total, 0);
    assert.equal((await request(independent, '/nutritionist/meal-review-cases?state=PENDING_REREVIEW'))[0].id, meal.id);
    assert.deepEqual(await request(independent, '/nutritionist/meal-review-cases?state=QUARANTINED'), []);
    assert.equal((await request(member, '/user/meals/verified-recipes')).total, 0);
    passed('First flag withholds meal and moves it exclusively to pending re-review');
    const pending = await detail();
    for (const actor of [verifier, flagger]) {
      const denied = await request(actor, `/nutritionist/meal-review-cases/${meal.id}/claim`, 'POST', { expectedVersion: pending.reviewVersion }, 403);
      assert.equal(denied.errorCode ?? denied.code, 'REVIEWER_INVOLVED');
    }
    passed('Previous verifier and flagger are excluded from claiming');
    const excludedPage = await pageFor(verifier, `/nutritionist/library?mealId=${meal.id}`);
    await expect(excludedPage.getByRole('button', { name: 'Claim re-review', exact: true })).toBeDisabled();
    await expect(excludedPage.getByText(/An independent RND must review this meal/)).toBeVisible();
    await excludedPage.screenshot({ path: resolve(evidence, '00-excluded-verifier.png'), fullPage: true });
    const reviewerPage = await pageFor(independent, `/nutritionist/library?mealId=${meal.id}`);
    await expect(reviewerPage.getByRole('heading', { name: 'Synthetic Lifecycle Squash', exact: true }).first()).toBeVisible();
    await expect(reviewerPage.getByText(notes.explanation, { exact: true }).first()).toBeVisible();
    await expect(reviewerPage.getByText(notes.reference, { exact: false }).first()).toBeVisible();
    await reviewerPage.getByRole('button', { name: 'Claim re-review', exact: true }).click();
    await expect(reviewerPage.getByRole('button', { name: 'Claim re-review', exact: true })).toBeDisabled();
    await reviewerPage.screenshot({ path: resolve(evidence, '01-claimed-review.png'), fullPage: true });
    const conflict = await request(competing, `/nutritionist/meal-review-cases/${meal.id}/claim`, 'POST', { expectedVersion: pending.reviewVersion }, 409);
    assert.equal(conflict.errorCode ?? conflict.code, 'REVIEW_CLAIM_CONFLICT');
    const claimed = await detail();
    assert.equal(claimed.claimStatus.claimedByMe, true);
    assert.deepEqual(claimed.incident.reports[0].notes, notes);
    assert.equal(claimed.incident.reports[0].actorSnapshot.name, flagger.user.name);
    assert.ok(JSON.stringify(claimed.currentSnapshot).includes(food.name));
    passed('Independent claim is exclusive; details contain exact ingredients and flagger notes');
    // Claims change ownership and must be traceable alongside decisions.
    assert.equal(await db.auditEvent.count({ where: { entityId: meal.id, action: 'MEAL_REVIEW_CLAIMED', actorUserId: independent.user.id } }), 1,
      'Independent re-review claim is missing from audit');
    const resolution = 'Synthetic sodium concern resolved by checking 100 g against fixture revision one; recorded sodium is 10 mg.';
    await reviewerPage.getByLabel('How you resolved this concern').fill(resolution);
    await reviewerPage.getByRole('button', { name: 'Mark resolved', exact: true }).click();
    await reviewerPage.getByLabel('Independent review findings').fill('Synthetic independent review confirms the exact measured recipe and resolves every concern.');
    await reviewerPage.getByRole('checkbox').check();
    await reviewerPage.getByRole('button', { name: 'Re-verify recipe', exact: true }).click();
    await expect(reviewerPage.getByRole('button', { name: 'Re-verify recipe', exact: true })).toHaveCount(0);
    assert.equal((await detail()).state, 'PUBLISHED');
    assert.equal((await request(independent, '/nutritionist/library')).meals[0].id, meal.id);
    assert.equal((await request(member, '/user/meals/verified-recipes')).items[0].id, meal.id);
    assert.deepEqual(await request(independent, '/nutritionist/meal-review-cases?state=PENDING_REREVIEW'), []);
    const saved = await db.mealReviewDecision.findFirstOrThrow({ where: { action: 'CONFIRMED' } });
    assert.ok(JSON.stringify(saved.snapshot).includes(resolution));
    assert.equal(saved.actorUserId, independent.user.id);
    await reviewerPage.screenshot({ path: resolve(evidence, '02-republished-meal.png'), fullPage: true });
    const memberPage = await pageFor(member, '/meals');
    await memberPage.getByRole('button', { name: /^Library/ }).click();
    await expect(memberPage.getByText('Synthetic Lifecycle Squash', { exact: true }).first()).toBeVisible();
    await memberPage.screenshot({ path: resolve(evidence, '02-member-library.png'), fullPage: true });
    passed('Independent resolution is persisted and the recipe returns to Verified');
    assert.equal((await flag()).reviewState, 'QUARANTINED');
    assert.equal((await request(independent, '/nutritionist/library')).total, 0);
    assert.deepEqual(await request(independent, '/nutritionist/meal-review-cases?state=PENDING_REREVIEW'), []);
    assert.equal((await request(independent, '/nutritionist/meal-review-cases?state=QUARANTINED'))[0].id, meal.id);
    const quarantined = await detail();
    const quarantinePage = await pageFor(independent, '/nutritionist/library');
    await quarantinePage.getByRole('button', { name: 'Quarantined', exact: true }).click();
    await expect(quarantinePage.getByRole('cell', { name: 'Synthetic Lifecycle Squash', exact: true })).toBeVisible();
    await quarantinePage.screenshot({ path: resolve(evidence, '03-quarantined.png'), fullPage: true });
    const locked = await request(competing, `/nutritionist/meal-review-cases/${meal.id}/claim`, 'POST', { expectedVersion: quarantined.reviewVersion }, 409);
    assert.equal(locked.errorCode ?? locked.code, 'QUARANTINE_ADMIN_REQUIRED');
    assert.equal(quarantined.history.length, 2);
    passed('Second flag creates incident two in Quarantined; RND cannot release it');
    const events = await db.auditEvent.findMany({ where: { entityId: meal.id }, orderBy: { createdAt: 'asc' } });
    const required = ['ADMIN_MEAL_DRAFT_CREATED', 'BASE_MEAL_VERIFIED', 'MEAL_REVIEW_FLAGGED', 'MEAL_REVIEW_CLAIMED', 'MEAL_REVIEW_CONFIRMED', 'MEAL_REVIEW_REVERIFIED'];
    for (const action of required) assert.ok(events.some(event => event.action === action), `Missing ${action}`);
    assert.equal(events.filter(event => event.action === 'MEAL_REVIEW_FLAGGED').length, 2);
    const audit = await request(independent, '/nutritionist/audit-history?limit=50');
    for (const event of events.filter(event => event.actorUserId !== admin.user.id))
      assert.ok(JSON.stringify(audit).includes(event.id), `Audit presentation missing ${event.action}`);
    const confirmationEvent = events.find(event => event.action === 'MEAL_REVIEW_CONFIRMED')!;
    const context = await request(admin, `/admin/audit-history/${confirmationEvent.id}/review-context`);
    assert.ok(JSON.stringify(context).includes(resolution));
    const adminAudit = await request(admin, '/admin/audit-history?view=admin&limit=50');
    assert.ok(JSON.stringify(adminAudit).includes(events.find(event => event.action === 'ADMIN_MEAL_DRAFT_CREATED')!.id));
    const auditPage = await pageFor(independent, '/nutritionist/audit');
    await expect(auditPage.getByText('Claimed a meal re-review', { exact: true })).toBeVisible();
    await expect(auditPage.getByText('Re-verified a meal', { exact: true })).toBeVisible();
    await auditPage.screenshot({ path: resolve(evidence, '04-rnd-audit.png'), fullPage: true });
    const adminPage = await pageFor(admin, '/admin/audit');
    await adminPage.getByRole('button', { name: 'RND history', exact: true }).click();
    await adminPage.getByRole('button', { name: 'Details: Resolved meal concerns — Synthetic Lifecycle Squash', exact: true }).click();
    await adminPage.getByRole('combobox', { name: 'Review change' }).click();
    await adminPage.getByRole('option', { name: /Incident 1 · Independent confirmation/ }).click();
    await expect(adminPage.getByRole('region', { name: 'Recorded concern resolutions' })).toContainText(resolution);
    await adminPage.screenshot({ path: resolve(evidence, '05-admin-resolution-audit.png'), fullPage: true });
    passed('Stored events and staff audit endpoint trace every recipe change with its actor');
    writeFileSync(resolve(evidence, 'report.json'), JSON.stringify({ timestamp: new Date().toISOString(), database, mealId: meal.id, checks,
      events: events.map(({ id, action, actorUserId, createdAt }) => ({ id, action, actorUserId, createdAt })),
    }, null, 2));
    console.log(`Evidence: ${evidence}`);
  } catch (error) {
    if (browserContexts.length) {
      writeFileSync(resolve(evidence, 'browser-failure.txt'), String((error as Error).message).replace(/[a-f0-9]{64}/g, '[digest]'));
      for (let index = 0; index < browserContexts.length; index++) {
        const page = browserContexts[index].pages()[0];
        if (page) await page.screenshot({ path: resolve(evidence, `failure-${index}.png`), fullPage: true });
      }
      console.log(`Browser failure evidence: ${evidence}`);
    }
    throw error;
  } finally {
    for (const context of browserContexts) await context.close();
    await browser.close();
    server.closeAllConnections();
    await new Promise<void>(done => server.close(() => done()));
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error instanceof assert.AssertionError || error?.name === 'TimeoutError' ? error.message : 'Isolated lifecycle test failed; no hosted target was used.'); process.exitCode = 1; });
