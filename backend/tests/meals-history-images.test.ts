import assert from 'node:assert/strict';
import test from 'node:test';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../src/types';
import { resolvePlanImage } from '../src/services/meal-plan-presentation.service';

const raw = {
  recipeName: 'Bam-I Recipe',
  sourceName: 'PANLASANG_PINOY',
  sourceUrl: 'https://panlasangpinoy.com/bam-i/',
  sourceImageUrl: 'https://panlasangpinoy.com/wp-content/uploads/2026/10/bam-i.jpg',
  sourceVideoUrl: null,
};
const libraryMeal = {
  id: 'library-bam-i',
  mealName: raw.recipeName,
  description: `Source: ${raw.sourceUrl}`,
  derivationKind: null,
  adaptedImageUrl: null,
  sourceVideoUrl: null,
  imagePublicId: null,
  imageVersion: null,
  imageFormat: null,
  imageKind: null,
  imageAltText: null,
  imageCreator: null,
  imageSourcePageUrl: null,
  imageLicenseCode: null,
  imageLicenseUrl: null,
};
const log = {
  id: 'recorded-log',
  mealName: raw.recipeName,
  source: 'SYSTEM_GENERATED',
  calories: 912,
  proteinG: 30,
  carbsG: 139,
  fatG: 26,
  status: 'DONE',
  loggedAt: new Date('2026-10-12T04:00:00Z'),
  outsideItems: [],
  mealPlan: {
    mealName: raw.recipeName,
    mealType: 'LUNCH',
    libraryMeal,
    selectionEvidence: { privateContext: 'must-not-leak' },
    swapLogs: [],
  },
};
function response() {
  let code = 0;
  let body: any;
  const res = {
    status(value: number) {
      code = value;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  };
  return { res: res as unknown as Response, result: () => ({ code, body }) };
}

test('history image response contract', async (parent) => {
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  const prisma = {
    mealLog: { findMany: async (_args: unknown): Promise<unknown[]> => [] },
    rawRecipeCandidate: { findMany: async (_args: unknown): Promise<unknown[]> => [] },
  };
  globals.prisma = prisma;
  parent.after(() => {
    globals.prisma = previous;
  });
  const { getPlanHistory } = await import('../src/controllers/meals-history.controller');
  await parent.test(
    'history batches source photos, preserves recorded intake and hides internal relations',
    async (context) => {
      context.mock.method(prisma.mealLog, 'findMany', async (args: any) => {
        assert.equal(args.where.userId, 'owner');
        assert.equal(args.select.mealPlan.select.sourceRawRecipeCandidate.select.sourceImageUrl, true);
        return [
          log,
          { ...log, id: 'old-log', mealName: 'Different old plate' },
          { ...log, id: 'outside-log', source: 'USER_LOGGED', outsideImageMime: 'image/jpeg', mealPlan: null },
        ];
      });
      let imageQueries = 0;
      context.mock.method(prisma.rawRecipeCandidate, 'findMany', async (args: any) => {
        imageQueries++;
        assert.deepEqual(args.where.sourceUrl.in, [raw.sourceUrl]);
        return [raw];
      });
      const output = response();
      await getPlanHistory({ user: { userId: 'owner' }, query: {} } as unknown as AuthenticatedRequest, output.res);
      const { code, body } = output.result();
      assert.equal(code, 200);
      assert.equal(imageQueries, 1);
      assert.deepEqual(body.data[0].image, resolvePlanImage({ sourceRawRecipeCandidate: raw }));
      assert.equal(body.data[0].mealName, raw.recipeName);
      assert.deepEqual(
        [body.data[0].calories, body.data[0].proteinG, body.data[0].carbsG, body.data[0].fatG],
        [912, 30, 139, 26]
      );
      assert.equal(body.data[0].mealType, 'LUNCH');
      assert.equal(body.data[1].image, null);
      assert.equal(body.data[2].image, null);
      assert.equal(body.data[2].hasImage, true);
      assert.ok(!JSON.stringify(body).includes('must-not-leak'));
      assert.ok(!('mealPlan' in body.data[0]));
    }
  );

  await parent.test('unauthenticated history cannot load logs or recipe photos', async (context) => {
    context.mock.method(prisma.mealLog, 'findMany', async () => assert.fail('no unauthenticated read'));
    context.mock.method(prisma.rawRecipeCandidate, 'findMany', async () =>
      assert.fail('no unauthenticated image read')
    );
    const output = response();
    await getPlanHistory({ query: {} } as AuthenticatedRequest, output.res);
    assert.equal(output.result().code, 401);
  });
});
