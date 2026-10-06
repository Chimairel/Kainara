/** Restore food tokens swallowed by the source parser's measurement-unit field.
 * Quantity is already per serving and is never recomputed. A title alone is not evidence.
 * Verified examples: panlasangpinoy.com/eggplant-and-ground-chicken-omelet/,
 * /inihaw-na-pusit-grilled-squid/, /scrambled-eggs-with-sun-dried-tomato-and-bacon/.
 */
export const SOURCE_IDENTITY_RECOVERY_VERSION = 'SOURCE_FOOD_UNIT_RECOVERY_V1';

type Ingredient = Record<string, unknown> & { name?: unknown; quantity?: unknown; unit?: unknown };
const countFoods: Readonly<Record<string, string>> = {
  egg: 'egg',
  eggs: 'eggs',
  squid: 'squid',
  shrimp: 'shrimp',
  onion: 'onion',
  tomato: 'tomato',
  carrot: 'carrot',
  lemon: 'lemon',
};

export function recoverSourceIngredientIdentity<T extends Ingredient>(
  ingredient: T
): {
  ingredient: T;
  recovered: boolean;
} {
  const name = typeof ingredient.name === 'string' ? ingredient.name.trim() : '';
  const unit = typeof ingredient.unit === 'string' ? ingredient.unit.trim().toLowerCase() : '';
  if (typeof ingredient.quantity !== 'number' || !Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0)
    return { ingredient, recovered: false };
  let food = countFoods[unit];
  let measurement = 'piece';
  const preparation =
    /^(?:\((?:beaten|whole|cleaned|diced|chopped|minced|deveined|juiced|boiled and peeled|cooked sunny side up)\)|cooked over easy|yolks)$/iu.test(
      name
    );
  if (unit === 'bacon' && /^strips(?: \(chopped\))?$/iu.test(name)) {
    food = 'bacon';
    measurement = 'strip';
  } else if (!food || !preparation) return { ingredient, recovered: false };
  return {
    recovered: true,
    ingredient: {
      ...ingredient,
      name: `${food} ${name}`,
      unit: measurement,
      excludedFromPlanning: false,
      sourceIdentityRecovery: {
        version: SOURCE_IDENTITY_RECOVERY_VERSION,
        priorName: ingredient.name,
        priorUnit: ingredient.unit,
        evidence: 'Food identity explicitly present in original source unit field; quantity unchanged.',
      },
    },
  };
}
