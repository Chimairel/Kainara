import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET ||= 'synthetic-grocery-cost-key';
process.env.JWT_REFRESH_SECRET ||= 'synthetic-grocery-cost-refresh';

test('grocery cost batches identities and evidence while retaining quantity and ambiguity rules', async (t) => {
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  let foodReads = 0;
  let mappingReads = 0;
  const observation = {
    id: 'observation', commodityId: 'rice', sourceObservationKey: 'synthetic-rice',
    amountMinCentavos: 5000, amountMaxCentavos: 6000,
    normalizedQuantity: { toNumber: () => 1 }, normalizedUnit: 'KILOGRAM',
    observedTo: new Date(), supersedesObservationId: null,
    geography: { level: 'NATIONAL', displayName: 'Philippines' },
    publication: { source: { code: 'PSA_OPENSTAT' }, sourceUrl: 'https://example.test/prices' },
  };
  globals.prisma = {
    userProfile: { findUniqueOrThrow: async () => ({ planningProvinceHucName: null, planningRegionName: null }) },
    foodItem: { findMany: async () => {
      foodReads++;
      return [{ id: 'rice', name: 'Rice' }, { id: 'salt-a', name: 'Salt' }, { id: 'salt-b', name: 'SALT' }];
    } },
    ingredientPriceCommodityMapping: {
      findMany: async (args: { where: { foodItemId: { in: string[] } } }) => {
        mappingReads++;
        assert.deepEqual(args.where.foodItemId.in, ['rice']);
        return [{ foodItemId: 'rice', commodityId: 'rice', state: 'EXACT', evidenceReference: 'synthetic',
          commodity: { observations: [observation] } }];
      },
      count: async () => 1,
    },
    ingredientPriceObservation: { count: async () => 1 },
  };
  t.after(() => { globals.prisma = previous; });
  const { GroceryService } = await import('../src/services/grocery.service');
  const { GroceryCostService } = await import('../src/services/grocery-cost.service');
  const items = [
    ...Array.from({ length: 40 }, (_, i) => ({ id: `rice-${i}`, ingredientName: i % 2 ? 'RICE' : 'Rice', quantity: 500 })),
    { id: 'ambiguous', ingredientName: 'Salt', quantity: 100 },
    { id: 'checked', ingredientName: 'Rice', quantity: 500, isChecked: true },
    { id: 'pantry', ingredientName: 'Rice', quantity: 500, isPantryStaple: true },
    { id: 'zero', ingredientName: 'Rice', quantity: 0 },
  ].map((item) => ({ isChecked: false, isPantryStaple: false, unit: 'g', purchasedQuantity: 100, ...item }));
  // The fixture replaces list acquisition only; all estimate selection rules run normally.
  t.mock.method(GroceryService, 'getGroceryList', async () => ({ groceryItems: items }));
  const result = await GroceryCostService.estimate('synthetic-owner');
  assert.equal(foodReads, 1);
  assert.equal(mappingReads, 1);
  assert.equal(result.estimates.length, 41);
  assert.equal(result.evidence.length, 40);
  const rice = result.estimates[0];
  assert.equal(rice.status, 'AVAILABLE');
  if (rice.status === 'AVAILABLE') {
    assert.equal(rice.amountMinCentavos, 2000);
    assert.equal(rice.amountMaxCentavos, 2400);
  }
  assert.equal(result.estimates.at(-1)?.status, 'UNAVAILABLE');
  assert.equal(result.status, 'PARTIAL');
  t.mock.method(GroceryService, 'getGroceryList', async () => ({ groceryItems: [] }));
  assert.equal((await GroceryCostService.estimate('synthetic-owner')).availabilityReason, 'NOTHING_TO_PRICE');
  assert.equal(foodReads, 1);
  assert.equal(mappingReads, 1);
});
