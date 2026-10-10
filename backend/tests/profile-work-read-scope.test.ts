import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import prisma from '../src/lib/prisma';
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';
import { NutritionistProfileWorkService } from '../src/services/nutritionist-profile-work.service';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';
import { profileReadUser, type ProfileRead } from '../src/services/clinical-profile-review.context';

// Prisma extensions expose methods through proxies rather than own descriptors.
function replace(t: TestContext, target: any, method: string, implementation: any) {
  const original = target[method];
  target[method] = implementation;
  t.after(() => {
    target[method] = original;
  });
}

test('opening one member scopes both queue sources and shares evidence only within that request', async (t) => {
  let workspaceReads = 0;
  t.mock.method(
    ClinicalProfileReviewService,
    'queue',
    async (reviewer: string | undefined, userId: string | undefined) => {
      assert.equal(reviewer, undefined);
      assert.equal(userId, 'selected');
      return [{ userId, name: 'Synthetic', conditions: [], allergies: [], status: 'PENDING' }] as never;
    }
  );
  replace(t, prisma.clinicalDocument, 'findMany', async ({ where }: any) => {
    assert.equal(where.userId, 'selected');
    assert.equal(where.user.role, 'USER');
    assert.deepEqual(where.status.in, ['UPLOADED', 'NEEDS_CLARIFICATION']);
    return [];
  });
  t.mock.method(ClinicalEvidenceService, 'workspace', async (userId: string) => {
    assert.equal(userId, 'selected');
    workspaceReads++;
    return { documents: [], requirements: [], availableAreas: [] } as never;
  });
  t.mock.method(
    ClinicalProfileReviewService,
    'detail',
    async (
      userId: string,
      reviewerId: string | undefined,
      workspace?: Promise<Awaited<ReturnType<typeof ClinicalEvidenceService.workspace>>>
    ) => {
      assert.equal(userId, 'selected');
      assert.equal(reviewerId, 'rnd');
      assert.ok(workspace);
      await workspace;
      return { profileRevision: 4 } as never;
    }
  );
  replace(
    t,
    prisma.user,
    'findUnique',
    async () =>
      ({
        role: 'USER',
        id: 'selected',
        name: 'Synthetic',
        healthConditions: [],
        allergies: [],
        userProfile: { revision: 4 },
      }) as never
  );
  replace(t, prisma.nutritionReportVersion, 'findMany', async () => []);
  replace(t, prisma.nutritionReport, 'findUnique', async () => null);
  for (let request = 0; request < 2; request++) {
    const result = await NutritionistProfileWorkService.detail('selected', 'rnd');
    assert.equal(result.currentProfile.revision, 4);
  }
  assert.equal(workspaceReads, 2, 'No cross-request clinical caching');
});

test('request-local profile reads cannot be reused for another member or staff role', () => {
  const read = { user: { id: 'selected', role: 'USER' } } as ProfileRead;
  assert.equal(profileReadUser('selected', read), read.user);
  assert.throws(() => profileReadUser('another', read), /does not belong/);
  assert.throws(() => profileReadUser('selected', { user: { ...read.user, role: 'ADMIN' } }), /does not belong/);
});

test('a selected member with no pending work stays unavailable', async (t) => {
  replace(t, prisma.user, 'findUnique', async () => ({ id: 'unqueued', role: 'USER' }) as never);
  t.mock.method(ClinicalProfileReviewService, 'queue', async () => []);
  replace(t, prisma.clinicalDocument, 'findMany', async () => []);
  t.mock.method(ClinicalEvidenceService, 'workspace', async () => {
    throw Error('Must not read an unqueued case');
  });
  await assert.rejects(NutritionistProfileWorkService.detail('unqueued', 'rnd'), /no profile work/);
});
