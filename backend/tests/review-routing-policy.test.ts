import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../src/lib/prisma';
import { ReviewRoutingService } from '../src/services/review-routing.service';
import { expertiseSchema } from '../src/validation/review-routing.schemas';

const shared = { stage: 'GENERAL', reason: 'SHARED_POOL', opensAt: null };

test('shared pool ignores persisted priority settings, expertise, experience and historical episodes without writes', async () => {
  const configRead = prisma.reviewRoutingConfig.findUnique;
  const episodeRead = prisma.reviewRoutingEpisode.findUnique;
  const transaction = prisma.$transaction;
  prisma.reviewRoutingConfig.findUnique = (async () => {
    throw new Error('Legacy config must not be read');
  }) as never;
  prisma.reviewRoutingEpisode.findUnique = (async () => {
    throw new Error('Legacy episodes must not be enforced');
  }) as never;
  prisma.$transaction = (async () => {
    throw new Error('Queue access must not change priority or claims');
  }) as never;
  try {
    assert.equal((await ReviewRoutingService.config()).enabled, false);
    assert.equal((await ReviewRoutingService.config()).retired, true);
    const meals = [
      { id: 'heart-case', userId: 'heart-member' },
      { id: 'renal-case', userId: 'renal-member' },
    ];
    const people = [{ userId: 'heart-member' }, { userId: 'renal-member' }];
    for (const reviewer of ['heart-specialist', 'renal-specialist', 'experienced-general', 'new-rnd']) {
      assert.deepEqual(
        await ReviewRoutingService.filterMeals(meals, reviewer),
        meals.map((meal) => ({ ...meal, routing: shared }))
      );
      assert.deepEqual(
        await ReviewRoutingService.filterProfiles(people, reviewer),
        people.map((person) => ({ ...person, routing: shared }))
      );
      assert.deepEqual(await ReviewRoutingService.assertProfile(reviewer, 'heart-member'), shared);
      assert.deepEqual(await ReviewRoutingService.assertDocument(reviewer, 'heart-evidence'), shared);
    }
    assert.equal(await ReviewRoutingService.resolve({ userId: 'heart-member' }), null);
    await ReviewRoutingService.sweep();
  } finally {
    prisma.reviewRoutingConfig.findUnique = configRead;
    prisma.reviewRoutingEpisode.findUnique = episodeRead;
    prisma.$transaction = transaction;
  }
});

test('legacy enable requests cannot restore priority and still require an active administrator', async () => {
  const adminRead = prisma.user.findFirst;
  try {
    prisma.user.findFirst = (async () => ({ id: 'admin' })) as never;
    await assert.rejects(ReviewRoutingService.setEnabled('admin', true), {
      statusCode: 410,
      errorCode: 'REVIEW_ROUTING_RETIRED',
    });
    assert.equal((await ReviewRoutingService.setEnabled('admin', false)).enabled, false);
    prisma.user.findFirst = (async () => null) as never;
    await assert.rejects(ReviewRoutingService.setEnabled('member', false), {
      statusCode: 403,
      errorCode: 'ADMIN_REQUIRED',
    });
  } finally {
    prisma.user.findFirst = adminRead;
  }
});

test('admin expertise inputs reject NONE, unknown tags, fabricated years and missing evidence', () => {
  const valid = {
    conditions: ['HEART_CONDITION'],
    experienceYears: 0,
    evidence: 'Reviewed synthetic training reference.',
  };
  assert.equal(expertiseSchema.safeParse(valid).success, true);
  for (const change of [
    { conditions: ['NONE'] },
    { conditions: ['UNKNOWN'] },
    { experienceYears: -1 },
    { experienceYears: 1.5 },
    { experienceYears: 71 },
    { experienceYears: null },
    { evidence: '' },
    { acceptingReviews: true },
  ])
    assert.equal(expertiseSchema.safeParse({ ...valid, ...change }).success, false);
  assert.equal(expertiseSchema.safeParse({ ...valid, conditions: [], experienceYears: null }).success, true);
  assert.equal(expertiseSchema.safeParse({ ...valid, conditions: [], experienceYears: 20 }).success, true);
});
