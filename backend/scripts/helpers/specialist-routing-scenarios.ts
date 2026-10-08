import assert from 'node:assert/strict';
import type { HealthConditionType, NutritionistProfile, Role, User } from '@prisma/client';
import prisma from '../../src/lib/prisma';
import { ReviewRoutingService } from '../../src/services/review-routing.service';

type Actor = Pick<User, 'id' | 'email' | 'role'>;
type RequestResult = { status: number; body: { success?: boolean; data?: unknown; error?: string } };
type Fixture = {
  admin: Actor;
  existingReviewerIds: string[];
  account: (role: Role) => Promise<User>;
  member: (conditions: HealthConditionType[]) => Promise<User>;
  cycleWithMeals: (userId: string) => Promise<{ cycle: { id: string }; meals: { id: string }[] }>;
  request: (actor: Actor, path: string, method?: string, body?: unknown) => Promise<RequestResult>;
};

/** Called only after the parent acceptance script checks its fresh loopback database target. */
export async function specialistRoutingScenarios(fixture: Fixture) {
  const { admin, account, member, cycleWithMeals, request } = fixture;
  const ok = async <T = unknown>(promise: Promise<RequestResult>): Promise<T> => {
    const result = await promise;
    assert.equal(result.status, 200, result.body.error);
    assert.equal(result.body.success, true);
    return result.body.data as T;
  };
  // Keep this matrix independent from the earlier revoked/expired/claimed fixtures.
  await prisma.nutritionistProfile.updateMany({
    where: { id: { in: fixture.existingReviewerIds } },
    data: { isVerified: false },
  });
  const definitions: Array<{
    name: string;
    years: number;
    tags: HealthConditionType[];
    verified?: boolean;
  }> = [
    { name: 'Alex', years: 30, tags: [] },
    { name: 'Bea', years: 18, tags: ['KIDNEY_DISEASE'] },
    { name: 'Cora', years: 12, tags: ['HEART_CONDITION'] },
    { name: 'Dani', years: 8, tags: ['HEART_CONDITION', 'DIABETES'] },
    { name: 'Ella', years: 6, tags: ['DIABETES'] },
    { name: 'Faye', years: 4, tags: ['HEART_CONDITION'] },
    { name: 'Gio', years: 2, tags: ['HEART_CONDITION'] },
    { name: 'Hana', years: 25, tags: ['HYPERTENSION'] },
    { name: 'Iris', years: 40, tags: ['HEART_CONDITION'], verified: false },
    { name: 'Jules', years: 30, tags: [] },
  ];
  const rnds: Array<(typeof definitions)[number] & { user: User; profile: NutritionistProfile }> = [];
  for (const definition of definitions) {
    const user = await account('NUTRITIONIST');
    const profile = await prisma.nutritionistProfile.create({
      data: {
        userId: user.id,
        prcLicenseNumber: `SYNTHETIC-MATRIX-${definition.name}`,
        prcLicenseExpiry: new Date('2031-01-01'),
        isVerified: true,
        specialization: 'Synthetic self-reported specialization',
        yearsOfExperience: definition.years,
      },
    });
    if (definition.verified !== false)
      await ok(
        request(admin, `/admin/review-routing/expertise/${profile.id}`, 'PUT', {
          conditions: definition.tags,
          experienceYears: definition.years,
          evidence: 'Fictional qualification and employment evidence for software testing only.',
        })
      );
    assert.equal(profile.acceptingReviews, false, 'Legacy availability must not prevent automatic access.');
    rnds.push({ ...definition, user, profile });
  }
  const nameFor = (id: string) => rnds.find((rnd) => rnd.profile.id === id)?.name ?? 'Unexpected reviewer';
  const cases: Array<{ label: string; conditions: HealthConditionType[]; reason: string; expected: string[] }> = [
    {
      label: 'Heart condition',
      conditions: ['HEART_CONDITION'],
      reason: 'MATCHING_EXPERTISE',
      expected: ['Cora', 'Dani', 'Faye', 'Gio'],
    },
    { label: 'Diabetes', conditions: ['DIABETES'], reason: 'MATCHING_EXPERTISE', expected: ['Dani', 'Ella'] },
    {
      label: 'Heart condition and diabetes',
      conditions: ['HEART_CONDITION', 'DIABETES'],
      reason: 'MATCHING_EXPERTISE',
      expected: ['Dani'],
    },
    { label: 'Kidney disease', conditions: ['KIDNEY_DISEASE'], reason: 'MATCHING_EXPERTISE', expected: ['Bea'] },
    {
      label: 'Hypertension',
      conditions: ['HYPERTENSION'],
      reason: 'MATCHING_EXPERTISE',
      expected: ['Hana'],
    },
    {
      label: 'Pregnancy (no expert)',
      conditions: ['PREGNANT'],
      reason: 'EXPERIENCE_PRIORITY',
      expected: ['Alex', 'Jules'],
    },
    {
      label: 'Diabetes and kidney disease (no complete expert)',
      conditions: ['DIABETES', 'KIDNEY_DISEASE'],
      reason: 'EXPERIENCE_PRIORITY',
      expected: ['Alex', 'Jules'],
    },
  ];
  const results = [];
  for (const scenario of cases) {
    const user = await member(scenario.conditions);
    const before = await prisma.notification.findMany({
      where: { userId: { in: rnds.map((rnd) => rnd.user.id) } },
      select: { userId: true },
    });
    await ReviewRoutingService.resolve({ userId: user.id });
    const episode = await prisma.reviewRoutingEpisode.findFirstOrThrow({ where: { userId: user.id } });
    assert.equal(episode.reason, scenario.reason, scenario.label);
    assert.deepEqual(episode.selectedReviewerIds.map(nameFor).sort(), [...scenario.expected].sort(), scenario.label);
    const noticeTitle =
      scenario.reason === 'EXPERIENCE_PRIORITY'
        ? 'Experience priority review available'
        : 'Matching specialist review available';
    const after = await prisma.notification.findMany({
      where: { userId: { in: rnds.map((rnd) => rnd.user.id) } },
      select: { userId: true, title: true },
    });
    for (const rnd of rnds) {
      const selected = scenario.expected.includes(rnd.name);
      assert.equal(
        after.filter((notice) => notice.userId === rnd.user.id).length -
          before.filter((notice) => notice.userId === rnd.user.id).length,
        selected ? 1 : 0
      );
      if (selected) assert.ok(after.some((notice) => notice.userId === rnd.user.id && notice.title === noticeTitle));
      const queue = await ok<Array<{ userId: string }>>(request(rnd.user, '/nutritionist/profile-work'));
      assert.equal(
        queue.some((person) => person.userId === user.id),
        selected,
        `${scenario.label}: ${rnd.name} profile queue`
      );
      assert.equal((await request(rnd.user, `/nutritionist/profile-reviews/${user.id}`)).status, selected ? 200 : 404);
    }
    const first = rnds.find((rnd) => rnd.name === scenario.expected[0])!;
    await ok(request(first.user, `/nutritionist/profile-reviews/${user.id}/claim`, 'POST', {}));
    const detail = await ok<{ profileRevision: number; scopeKey: string }>(
      request(first.user, `/nutritionist/profile-reviews/${user.id}`)
    );
    await ok(
      request(first.user, `/nutritionist/profile-reviews/${user.id}/decision`, 'POST', {
        decision: 'APPROVED',
        notes: 'Fictional profile decision for routing verification only.',
        profileRevision: detail.profileRevision,
        scopeKey: detail.scopeKey,
      })
    );
    const work = await cycleWithMeals(user.id);
    const visibility = [];
    for (const rnd of rnds) {
      const selected = scenario.expected.includes(rnd.name);
      const queue = await ok<Array<{ userId: string }>>(request(rnd.user, '/nutritionist/queue'));
      const visible = queue.some((meal) => meal.userId === user.id);
      assert.equal(visible, selected, `${scenario.label}: ${rnd.name} meal queue`);
      const direct = await request(rnd.user, `/nutritionist/queue/${work.meals[0].id}`);
      assert.equal(direct.status, selected ? 200 : 404);
      visibility.push({ rnd: rnd.name, visible, detailStatus: direct.status });
    }
    const linked = await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: work.cycle.id } });
    assert.equal(linked.reviewRoutingEpisodeId, episode.id);
    results.push({ ...scenario, user, episode, work, visibility });
    console.log(
      `SCENARIO ${scenario.label}: ${episode.reason} -> ${episode.selectedReviewerIds.map(nameFor).join(', ')}; profile/meal visibility, direct access and initial notifications PASS`
    );
  }
  // Experience priority is a valid review claim despite the absence of condition-specific tags.
  const fallback = results.find((row) => row.conditions[0] === 'PREGNANT')!;
  const alex = rnds.find((rnd) => rnd.name === 'Alex')!;
  await ok(request(alex.user, `/nutritionist/queue/${fallback.work.meals[0].id}/claim`, 'POST', {}));
  await ReviewRoutingService.resolve({ userId: fallback.user.id, cycleId: fallback.work.cycle.id });
  assert.equal(
    (await prisma.mealPlan.findUniqueOrThrow({ where: { id: fallback.work.meals[0].id } })).claimedByNutritionistId,
    alex.profile.id
  );
  assert.equal((await request(alex.user, `/nutritionist/queue/${fallback.work.meals[0].id}`)).status, 200);
  assert.equal((await request(alex.user, `/nutritionist/queue/${fallback.work.meals[1].id}`)).status, 200);
  await ok(
    request(admin, `/admin/review-routing/expertise/${alex.profile.id}`, 'PUT', {
      conditions: [],
      experienceYears: null,
      evidence: 'Fictional experience verification revocation.',
    })
  );
  await ReviewRoutingService.resolve({ userId: fallback.user.id, cycleId: fallback.work.cycle.id });
  assert.equal(
    (await prisma.mealPlan.findUniqueOrThrow({ where: { id: fallback.work.meals[0].id } })).claimedByNutritionistId,
    null
  );
  const jules = rnds.find((rnd) => rnd.name === 'Jules')!;
  await ok(request(jules.user, `/nutritionist/queue/${fallback.work.meals[0].id}/claim`, 'POST', {}));
  const ella = rnds.find((rnd) => rnd.name === 'Ella')!;
  await ok(
    request(admin, `/admin/review-routing/expertise/${ella.profile.id}`, 'PUT', {
      conditions: ['DIABETES', 'PREGNANT'],
      experienceYears: 6,
      evidence: 'Fictional pregnancy qualification verified.',
    })
  );
  await ReviewRoutingService.resolve({ userId: fallback.user.id, cycleId: fallback.work.cycle.id });
  const upgraded = await prisma.reviewRoutingEpisode.findUniqueOrThrow({ where: { id: fallback.episode.id } });
  assert.equal(upgraded.reason, 'MATCHING_EXPERTISE');
  assert.deepEqual(upgraded.selectedReviewerIds.map(nameFor), ['Ella']);
  assert.equal(upgraded.beganAt.getTime(), fallback.episode.beganAt.getTime());
  assert.equal(upgraded.opensAt.getTime(), fallback.episode.opensAt.getTime());
  assert.equal((await request(ella.user, `/nutritionist/queue/${fallback.work.meals[0].id}`)).status, 200);
  assert.equal((await request(jules.user, `/nutritionist/queue/${fallback.work.meals[0].id}`)).status, 404);
  assert.equal(
    (await prisma.mealPlan.findUniqueOrThrow({ where: { id: fallback.work.meals[0].id } })).claimedByNutritionistId,
    null
  );
  assert.equal((await request(alex.user, `/nutritionist/queue/${fallback.work.meals[0].id}`)).status, 404);
  await ok(
    request(admin, `/admin/review-routing/expertise/${ella.profile.id}`, 'PUT', {
      conditions: ['DIABETES'],
      experienceYears: 6,
      evidence: 'Fictional pregnancy expertise revocation.',
    })
  );
  await ReviewRoutingService.resolve({ userId: fallback.user.id, cycleId: fallback.work.cycle.id });
  const downgraded = await prisma.reviewRoutingEpisode.findUniqueOrThrow({ where: { id: fallback.episode.id } });
  assert.equal(downgraded.reason, 'EXPERIENCE_PRIORITY');
  assert.deepEqual(downgraded.selectedReviewerIds.map(nameFor), ['Jules']);
  assert.equal(downgraded.opensAt.getTime(), fallback.episode.opensAt.getTime());
  console.log('SCENARIO fallback claim/revocation and newly verified expertise: PASS; original deadline retained.');
  const heart = results[0];
  await prisma.reviewRoutingEpisode.update({
    where: { id: heart.episode.id },
    data: {
      beganAt: new Date(Date.now() - 25 * 3_600_000),
      opensAt: new Date(Date.now() - 3_600_000),
    },
  });
  for (const rnd of rnds)
    assert.equal((await request(rnd.user, `/nutritionist/queue/${heart.work.meals[0].id}`)).status, 200);
  assert.equal(
    (await prisma.reviewRoutingEpisode.findUniqueOrThrow({ where: { id: heart.episode.id } })).reason,
    'WINDOW_EXPIRED'
  );
  assert.equal(await prisma.mealPlan.count({ where: { userId: heart.user.id, status: 'PENDING_REVIEW' } }), 2);
  for (const rnd of rnds)
    await ok(
      request(admin, `/admin/review-routing/expertise/${rnd.profile.id}`, 'PUT', {
        conditions: [],
        experienceYears: null,
        evidence: 'Fictional revocation of priority qualifications.',
      })
    );
  const noCandidates = await member(['PREGNANT']);
  await ReviewRoutingService.resolve({ userId: noCandidates.id });
  const general = await prisma.reviewRoutingEpisode.findFirstOrThrow({ where: { userId: noCandidates.id } });
  assert.equal(general.stage, 'GENERAL');
  assert.equal(general.reason, 'NO_AVAILABLE_MATCH');
  for (const rnd of rnds)
    assert.equal((await request(rnd.user, `/nutritionist/profile-reviews/${noCandidates.id}`)).status, 200);
  console.log('SCENARIO expiry/no available verified experience: general access PASS; meals remain pending.');
  return {
    rnds: definitions,
    cases: results.map(({ label, reason, expected, visibility }) => ({
      label,
      reason,
      firstPool: expected,
      visibility,
    })),
    expiry: 'All ten eligible RNDs gained access; both meals stayed pending.',
    noCandidates: 'General access opened immediately.',
    fallbackClaimAndExpertUpgrade: 'Claim continuation, verified-experience revocation and unchanged deadline passed.',
  };
}
