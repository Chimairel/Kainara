import assert from 'node:assert/strict';
import test, { before, type TestContext } from 'node:test';
import prisma from '../src/lib/prisma';
import { VerifiedRecipeCatalogService as Catalog } from '../src/services/verified-recipe-catalog.service';
import { invalidateCatalogueMatching } from '../src/lib/catalogue-matching-cache';

process.env.GEMINI_API_KEY = 'unit-test-key-never-sent';
let Recipes: typeof import('../src/services/member-assistant-recipe-facts.service').MemberAssistantRecipeFactsService;
let Nutrition: typeof import('../src/services/member-assistant-nutrition.service').MemberAssistantNutritionService;
before(async () => {
  Recipes = (await import('../src/services/member-assistant-recipe-facts.service')).MemberAssistantRecipeFactsService;
  Nutrition = (await import('../src/services/member-assistant-nutrition.service')).MemberAssistantNutritionService;
});
const page = (items: Array<{ id: string; name: string }>, total = items.length) => ({ items, total, page: 1, pageCount: 1, restrictedProfile: false }) as Awaited<ReturnType<typeof Catalog.list>>;
function delegate(t: TestContext, target: object, name: string, fn: unknown) {
  const object = target as Record<string, unknown>; const old = object[name]; object[name] = fn;
  t.after(() => { object[name] = old; });
}

test('a missing composition match falls back to the same member-scoped catalogue and lists sinigang variants', async t => {
  invalidateCatalogueMatching();
  delegate(t, prisma.foodItem, 'findMany', async () => []);
  const catalog = t.mock.method(Catalog, 'list', async (owner: string, input: Parameters<typeof Catalog.list>[1]) => {
    assert.equal(owner, 'member'); assert.equal(input.search, 'sinigang');
    return page([{ id: 'raw:fish', name: 'Air Fried Fish Sinigang sa Miso' }, { id: 'raw:beef', name: 'Beef Ribs Sinigang' }], 45);
  });
  delegate(t, prisma.rawRecipeCandidate, 'findFirst', async () => { throw new Error('must clarify variant'); });
  const reply = await Nutrition.facts('sinigang', undefined, 'member');
  assert.equal(catalog.mock.callCount(), 1);
  assert.match(reply.text, /Air Fried Fish Sinigang sa Miso/); assert.match(reply.text, /Beef Ribs Sinigang/);
  assert.doesNotMatch(reply.text, /couldn’t find/); assert.equal(reply.facts, undefined);
  assert.equal(reply.links?.[0].href, '/meals?tab=library');
});

test('an exact source recipe shows base-serving values and available extended nutrients with its actual source', async t => {
  t.mock.method(Catalog, 'list', async () => page([{ id: 'raw:fish', name: 'Air Fried Fish Sinigang sa Miso' }, { id: 'raw:beef', name: 'Beef Ribs Sinigang' }]));
  delegate(t, prisma.rawRecipeCandidate, 'findFirst', async (query: { where: { id: string; status: string } }) => {
    assert.equal(query.where.id, 'beef'); assert.equal(query.where.status, 'AVAILABLE');
    return { calories: 604.24, proteinG: 59, carbsG: 26, fatG: 30, sourceName: 'PANLASANG_PINOY',
      sourceUrl: 'https://panlasangpinoy.com/fixture-sinigang/', publishedNutrition: { sodiumMg: 0, fiberG: 2.6, sugarG: null } };
  });
  const reply = await Recipes.facts('member', 'Beef Ribs Sinigang');
  assert.ok(reply); assert.match(reply.text, /recorded recipe serving/); assert.match(reply.text, /Separately paired rice is excluded/);
  assert.equal(reply.facts?.find(row => row.label === 'Energy')?.value, '604.2 kcal');
  assert.equal(reply.facts?.find(row => row.label === 'Sodium')?.value, '0.0 mg');
  assert.equal(reply.facts?.find(row => row.label === 'Fiber')?.value, '2.6 g');
  assert.equal(reply.facts?.find(row => row.label === 'Sugar'), undefined);
  assert.equal(reply.references?.[0].href, 'https://panlasangpinoy.com/fixture-sinigang/');
});

test('manual recipe facts use stored serving evidence and recheck its current published state', async t => {
  t.mock.method(Catalog, 'list', async () => page([{ id: 'manual', name: 'Sinigang fixture' }]));
  delegate(t, prisma.mealLibrary, 'findFirst', async (query: { where: unknown }) => {
    assert.deepEqual(query.where, { id: 'manual', status: 'APPROVED', flags: { none: { status: 'PENDING' } } });
    return { calories: 220, proteinG: 20, carbsG: 10, fatG: 11, sodiumMg: null,
      nutritionServingDescription: 'One 250 g bowl', nutritionEvidenceSource: 'CALCULATED', sourceRawRecipeCandidate: null };
  });
  const reply = await Recipes.facts('member', 'Sinigang fixture');
  assert.match(reply!.text, /One 250 g bowl/); assert.match(reply!.text, /does not authorize/);
  assert.equal(reply!.facts?.find(row => row.label === 'Sodium'), undefined);
  delegate(t, prisma.mealLibrary, 'findFirst', async () => null);
  assert.equal(await Recipes.facts('member', 'Sinigang fixture'), null);
});

test('explicit FNRI requests never silently substitute recipes and existing composition matches remain unchanged', async t => {
  invalidateCatalogueMatching();
  const catalog = t.mock.method(Catalog, 'list', async () => { throw new Error('no recipe substitution'); });
  delegate(t, prisma.foodItem, 'findMany', async () => []);
  assert.match((await Nutrition.facts('sinigang', 'FNRI', 'member')).text, /couldn’t find a recorded FNRI\/USDA/);
  invalidateCatalogueMatching();
  delegate(t, prisma.foodItem, 'findMany', async () => [{ name: 'Adobo fixture', source: 'FNRI', calories: 210, proteinG: 25, carbsG: 3, fatG: 8 }]);
  assert.match((await Nutrition.facts('adobo', undefined, 'member')).text, /per 100 g/);
  assert.equal(catalog.mock.callCount(), 0);
});

test('an unavailable member-visible recipe does not expose another catalogue or imply clearance', async t => {
  t.mock.method(Catalog, 'list', async () => page([]));
  assert.equal(await Recipes.facts('member', 'sinigang'), null);
});

test('restricted members use existing profile-scoped admission instead of falling through to unrestricted source recipes', async t => {
  const old = process.env.MEMBERSHIP_ENABLED; process.env.MEMBERSHIP_ENABLED = 'false';
  t.after(() => { if (old === undefined) delete process.env.MEMBERSHIP_ENABLED; else process.env.MEMBERSHIP_ENABLED = old; });
  t.mock.method(Catalog, 'list', async () => ({ ...page([]), restrictedProfile: true }));
  delegate(t, prisma.user, 'findUnique', async (input: { where: { id: string } }) => {
    assert.equal(input.where.id, 'restricted-member');
    return { userProfile: { planningReportVersion: null, dietaryPreference: 'OMNIVORE', otherConditions: null, otherAllergies: null },
      healthConditions: [{ condition: 'HYPERTENSION' }], allergies: [], safetyProfileEntries: [] };
  });
  delegate(t, prisma.mealConditionClearance, 'findMany', async () => []);
  delegate(t, prisma.conditionRulePolicyVersion, 'findMany', async () => []);
  let queried = false;
  delegate(t, prisma.mealLibrary, 'findMany', async (input: { where: unknown }) => {
    queried = true;
    assert.match(JSON.stringify(input.where), /restricted-member/);
    assert.match(JSON.stringify(input.where), /sinigang/);
    return [];
  });
  delegate(t, prisma.rawRecipeCandidate, 'findFirst', async () => { throw new Error('no unrestricted source fallback'); });
  assert.equal(await Recipes.facts('restricted-member', 'sinigang'), null);
  assert.equal(queried, true);
});
