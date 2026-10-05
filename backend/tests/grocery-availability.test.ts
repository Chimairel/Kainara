import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET ||= 'synthetic-grocery-access-key';
process.env.JWT_REFRESH_SECRET ||= 'synthetic-grocery-refresh-key';

test('availability checklist preserves pantry stock, clears legacy marks and retains shopping guards', async (t) => {
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  const cycle = {
    status: 'READY_TO_SHOP',
    expectedSlotCount: 3,
    profileAdaptationState: 'CURRENT',
    deadlineOutcome: null,
    incompleteAcknowledgedAt: null,
    shoppingStartedAt: new Date(),
  };
  const list = { id: 'list', userId: 'owner', planGroupId: 'cycle', isStale: false, cycle };
  const item = {
    id: 'salt',
    groceryListId: list.id,
    groceryList: list,
    isChecked: false,
    isPantryStaple: true,
    quantity: null,
    purchasedQuantity: 0,
  };
  let mutations = 0;
  let matchingCount = 1;
  const tx = {
    $queryRaw: async () => [],
    $executeRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const sql = parts.join('?');
      if (sql.includes('UPDATE "GroceryItem"')) {
        assert.match(sql, /"isPantryStaple" = false/);
        assert.match(sql, /WHERE "groceryListId" = \? AND "id" IN/);
        mutations++;
        const checked = values[0] as boolean;
        Object.assign(item, {
          isChecked: checked,
          isPantryStaple: false,
          purchasedQuantity: checked ? (item.quantity ?? 0) : 0,
        });
      }
      return 1;
    },
    groceryItem: {
      findFirst: async ({ where }: { where: { id: string; groceryList: { userId: string; isStale: boolean } } }) => {
        assert.equal(where.groceryList.isStale, false);
        return where.id === item.id && where.groceryList.userId === list.userId && !list.isStale ? item : null;
      },
      count: async () => matchingCount,
      findMany: async () => [item],
      update: async ({ where, data }: { where: { id: string }; data: object }) => {
        assert.equal(where.id, item.id);
        mutations++;
        return Object.assign(item, data);
      },
    },
  };
  globals.prisma = { $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx) };
  t.after(() => {
    globals.prisma = previous;
  });
  const { GroceryService } = await import('../src/services/grocery.service');

  await t.test('unchecks existing pantry stock, then checks an unmeasured ingredient', async () => {
    await GroceryService.toggleGroceryItem('owner', 'salt');
    assert.equal(item.isChecked, false);
    assert.equal(item.isPantryStaple, false);
    assert.equal(item.purchasedQuantity, 0);
    await GroceryService.toggleGroceryItem('owner', 'salt');
    assert.equal(item.isChecked, true);
    assert.equal(item.purchasedQuantity, 0);
  });
  await t.test('bulk selection clears pantry state when checking and unchecking', async () => {
    for (const checked of [false, true]) {
      item.isPantryStaple = true;
      await GroceryService.setGroceryItemsChecked('owner', ['salt', 'salt'], checked);
      assert.equal(item.isChecked, checked);
      assert.equal(item.isPantryStaple, false);
    }
  });
  await t.test('another account and stale lists cannot change either state', async () => {
    const before = mutations;
    await assert.rejects(GroceryService.toggleGroceryItem('other', 'salt'), /Shopping list changed/);
    await assert.rejects(GroceryService.setGroceryItemsChecked('other', ['salt'], false), /Shopping list changed/);
    list.isStale = true;
    await assert.rejects(GroceryService.toggleGroceryItem('owner', 'salt'), /Shopping list changed/);
    list.isStale = false;
    assert.equal(mutations, before);
  });
  await t.test('mixed-list selections and revalidation gates reject before mutation', async () => {
    const before = mutations;
    matchingCount = 0;
    await assert.rejects(GroceryService.setGroceryItemsChecked('owner', ['salt'], false), /Shopping list changed/);
    matchingCount = 1;
    cycle.status = 'REVALIDATION_REQUIRED';
    await assert.rejects(GroceryService.toggleGroceryItem('owner', 'salt'));
    await assert.rejects(GroceryService.setGroceryItemsChecked('owner', ['salt'], false));
    assert.equal(mutations, before);
  });
});
