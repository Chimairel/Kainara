import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import prisma from '../src/lib/prisma';
import app from '../src/app';
import { lookupFnriIdentities, lookupFnriIngredients } from '../src/lib/fnri';
import { normalizeFoodName, selectStrongFNRIMatch } from '../src/domain/fnri-match.policy';
import { invalidateCatalogueMatching } from '../src/lib/catalogue-matching-cache';
import { ReviewStatusService } from '../src/services/review-status.service';
import { MealGenerationService } from '../src/services/meal-generation.service';
import { fixtureIdentity, accountSpecSchema } from '../src/services/dev-test-accounts/config';
import { sharedTestAccountPassword } from '../src/services/dev-test-accounts/password';
import { createAccounts } from '../src/services/dev-test-accounts/writer';
import { MealAiQueueService } from '../src/services/meal-ai-queue.service';

async function measured<T>(label: string, action: () => Promise<T>, details?: (value: T) => object) {
  process.send!({ type: 'start', label });
  await once(process, 'message');
  const value = await action();
  process.send!({ type: 'end', details: details?.(value) ?? {} });
  await once(process, 'message');
  return value;
}
async function main() {
  assert.equal(process.env.DEFENSE_TRANSFER_REHEARSAL, 'true');
  const target = new URL(process.env.DATABASE_URL!);
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.pathname, '/kainara_defense_recovery');
  // Retire only measurement cycles from earlier runs in this owned restore.
  // Repeated measurements must not accumulate new pending work in the fixture.
  const earlierMeters = await prisma.user.findMany({
    where: {
      role: 'USER',
      email: { startsWith: 'meter-', endsWith: '@example.test' },
      name: '[TEST sleep-oct11] Transfer measurement member',
    },
    select: { id: true },
  });
  const meterIds = earlierMeters.map((user) => user.id);
  if (meterIds.length) {
    await prisma.mealPlanCycle.updateMany({
      where: { userId: { in: meterIds } },
      data: { status: 'SUPERSEDED', supersededAt: new Date() },
    });
    await prisma.mealPlan.updateMany({ where: { userId: { in: meterIds } }, data: { status: 'CANCELLED' } });
  }
  const baseline = await measured('fnri-full-baseline', async () =>
    Promise.all([
      prisma.foodItem.findMany({ where: { source: 'FNRI' }, orderBy: { name: 'asc' } }),
      prisma.foodAlias.findMany({
        where: { foodItem: { source: 'FNRI' } },
        select: { alias: true, normalizedAlias: true, foodItemId: true, verifiedAt: true },
      }),
    ])
  );
  const [foods, aliases] = baseline;
  const names = [
    ...foods.map((food) => food.name),
    ...aliases.map((alias) => alias.alias),
    'chicken',
    'raw rice',
    'egg',
    'butter',
    'unknown synthetic food',
  ];
  const old = (name: string) => {
    const exact = foods.find((food) => food.name.toLowerCase() === name.toLowerCase());
    const alias = aliases.find(
      (item) =>
        [item.normalizedAlias, item.alias.toLowerCase()].includes(normalizeFoodName(name)) ||
        item.alias.toLowerCase() === name.toLowerCase()
    );
    const linked = alias && foods.find((food) => food.id === alias.foodItemId);
    const trusted = linked && (alias.verifiedAt || selectStrongFNRIMatch(name, [linked])) ? linked : null;
    const token = normalizeFoodName(name)
      .split(' ')
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0];
    return (
      exact ??
      trusted ??
      selectStrongFNRIMatch(
        name,
        token ? foods.filter((food) => food.name.toLowerCase().includes(token)).slice(0, 50) : []
      )
    );
  };
  invalidateCatalogueMatching();
  const identities = await measured(
    'fnri-identities-cold',
    () => lookupFnriIdentities(names),
    (value) => ({ matchedInputs: value.size })
  );
  for (const name of names)
    assert.equal(identities.get(name)?.id ?? null, old(name)?.id ?? null, `Identity mismatch for ${name}`);
  await measured('fnri-identities-warm', () => lookupFnriIdentities(names));
  const hydrated = await lookupFnriIngredients(['chicken', 'egg', 'unknown synthetic food']);
  for (const [name, food] of hydrated)
    assert.deepEqual(food, old(name), 'Full selected nutrient evidence must be preserved');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const specs = accountSpecSchema.parse(JSON.parse(readFileSync('.local/sleep-oct11/accounts.json', 'utf8')));
  const password = sharedTestAccountPassword(process.env);
  const tokens = new Map<string, string>();
  const request = async (path: string, email: string, options: RequestInit = {}) => {
    const response = await fetch(base + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(tokens.has(email) ? { Authorization: `Bearer ${tokens.get(email)}` } : {}),
        ...options.headers,
      },
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    const selected = specs.filter((spec) => !['expired', 'unverified', 'suspended'].includes(spec.alias));
    for (const spec of selected) {
      const { email } = fixtureIdentity('sleep-oct11', spec);
      const response = await request('/auth/login', email, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      assert.equal(response.status, 200, 'Ordinary fixture login failed');
      tokens.set(email, response.body.data.accessToken);
    }
    const admin = 'sleep-admin@example.test',
      rnd = 'sleep-rnd-a@example.test',
      member = 'sleep-healthy@example.test';
    for (const path of ['/admin/data/releases/retired/stats', '/admin/data/releases/retired/consumption-import'])
      assert.equal(
        (
          await request(path, admin, {
            method: path.endsWith('import') ? 'POST' : 'GET',
            ...(path.endsWith('import') ? { body: '{}' } : {}),
          })
        ).status,
        410
      );
    assert.equal((await request('/user/onboarding/planning-locations', member)).status, 410);
    assert.equal((await request('/admin/data/releases/retired/stats', member)).status, 403);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'sleep-heart@example.test' },
      select: { id: true },
    });
    const reviewer = await prisma.nutritionistProfile.findFirstOrThrow({
      where: { user: { email: rnd } },
      select: { id: true },
    });
    const first = await ReviewStatusService.profile(reviewer.id, user.id);
    assert.equal(JSON.stringify(first).includes('responses'), false);
    assert.equal((await ReviewStatusService.profile(reviewer.id, user.id)).revision, first.revision);
    const profile = await prisma.userProfile.findUniqueOrThrow({
      where: { userId: user.id },
      select: { revision: true },
    });
    await prisma.userProfile.update({ where: { userId: user.id }, data: { revision: profile.revision + 1 } });
    assert.notEqual((await ReviewStatusService.profile(reviewer.id, user.id)).revision, first.revision);
    await prisma.userProfile.update({ where: { userId: user.id }, data: { revision: profile.revision } });
    const generationSpecs = accountSpecSchema.parse([
      specs.find((spec) => spec.alias === 'admin'),
      { alias: 'meter', emailName: `meter-${Date.now()}`, role: 'USER', name: 'Transfer measurement member' },
    ]);
    const created = await createAccounts(prisma, 'sleep-oct11', generationSpecs, password);
    const healthy = created.find((account) => account.role === 'USER')!;
    await measured(
      'weekly-generation',
      async () => {
        const cycle = await MealGenerationService.generate7DayPlan(healthy.id, 'WEEKLY', 7, new Date());
        return prisma.mealPlan.count({ where: { planGroupId: cycle } });
      },
      (meals) => ({ meals })
    );
    // Ten concurrent ordinary accounts, using visible-page fallback schedules after cold loads.
    const needsCycleLookup = new Map<string, boolean>();
    const readRole = async (spec: (typeof selected)[number], tick: number) => {
      const email = fixtureIdentity('sleep-oct11', spec).email;
      if (spec.role === 'ADMIN') {
        if (tick === 0) assert.equal((await request('/admin/data', email)).status, 200);
      } else if (spec.role === 'RND') {
        if (tick % 4 === 0) {
          assert.equal((await request('/nutritionist/queue', email)).status, 200);
          assert.equal((await request('/nutritionist/profile-work', email)).status, 200);
          assert.equal((await request('/nutritionist/review-work-counts', email)).status, 200);
        }
        if (spec.alias === 'rnd-a')
          assert.equal((await request(`/nutritionist/profile-work/${user.id}/status`, email)).status, 200);
      } else if (tick % 4 === 0) {
        if (tick % 8 === 0) {
          const response = await request('/user/meals/current', email);
          assert(
            response.status === 200 ||
              (response.status === 422 && response.body.errorCode === 'CLINICAL_EVIDENCE_REQUIRED'),
            'Current plan must load or retain the clinical evidence gate'
          );
          needsCycleLookup.set(email, !response.body.meta?.cycle);
        }
        assert.equal((await request('/user/clinical-profile-review/status', email)).status, 200);
        if (needsCycleLookup.get(email)) {
          const cycles = await request('/user/meals/cycles', email);
          assert(
            cycles.status === 200 || (cycles.status === 422 && cycles.body.errorCode === 'CLINICAL_EVIDENCE_REQUIRED'),
            'Cycle listing must preserve the clinical evidence gate'
          );
        }
      }
      if (tick % 4 === 0) {
        assert.equal((await request('/user/profile', email)).status, 200);
        assert.equal((await request('/notifications', email)).status, 200);
      }
    };
    await Promise.all(selected.map((spec) => readRole(spec, 0)));
    await sleep(1000);
    for (const [path, email] of [
      ['/user/meals/current', member],
      ['/user/meals/cycles', member],
      ['/user/profile', member],
      ['/user/clinical-profile-review/status', member],
      ['/user/profile', 'sleep-heart@example.test'],
      ['/user/clinical-profile-review/status', 'sleep-heart@example.test'],
      ['/nutritionist/profile-work', rnd],
      ['/nutritionist/review-work-counts', rnd],
      [`/nutritionist/profile-work/${user.id}/status`, rnd],
    ])
      await measured('read:' + path + ':' + email.split('@')[0], () => request(path, email));
    const liveController = new AbortController();
    const streams = selected.map(async (spec) => {
      const email = fixtureIdentity('sleep-oct11', spec).email;
      while (!liveController.signal.aborted) {
        try {
          const response = await fetch(base + '/live/events', {
            headers: { Authorization: `Bearer ${tokens.get(email)}` },
            signal: liveController.signal,
          });
          assert.equal(response.status, 200);
          for await (const _chunk of response.body!) {
            void _chunk;
          }
          await sleep(3000, undefined, { signal: liveController.signal });
        } catch (cause) {
          if (!liveController.signal.aborted) throw cause;
        }
      }
    });
    try {
      await measured(
        'ten-session-steady',
        async () => {
          for (let tick = 0; tick < 12; tick++) {
            await Promise.all(selected.map((spec) => readRole(spec, tick)));
            await sleep(15000);
          }
          return true;
        },
        () => ({ sessions: selected.length, intervalSeconds: 15, ticks: 12 })
      );
    } finally {
      liveController.abort();
      await Promise.all(streams);
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
main()
  .then(() => (process.exitCode = 0))
  .catch(() => {
    console.error('Owned recovery workflow or transfer assertion failed; inspect the private log.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await MealAiQueueService.shutdown();
    await prisma.$disconnect();
    process.disconnect?.();
  });
