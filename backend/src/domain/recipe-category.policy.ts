/** Recipe identity/category guards; ingredient sugar alone never makes an ulam a dessert. */
export function isSnackOnlyRecipe(name: string, category?: string | null): boolean {
  const text = `${name} ${category ?? ''}`.normalize('NFKC').toLowerCase();
  const savoryCake = /\b(?:fish|crab|salmon|tuna|potato) cakes?\b/u.test(text);
  return (
    /\b(?:desserts?|brownies?|blondies?|cupcakes?|cheesecakes?|cookies?|muffins?|doughnuts?|donuts?|macaroons?|mousse|cand(?:y|ies)|puddings?|puto|kutsinta|palitaw|suman|biko|bibingka|binignit|turon|maruya|bananaque|banana cue|kamote cue|espasol|maja blanca|ube halaya|pichi[ -]pichi|polvoron|pastillas|yema|ensaymada|hopia|bilo[ -]bilo|sapin[ -]sapin|leche flan|ice cream|halo[ -]halo|beverages?|drinks?|smoothies?|milkshakes?|carioca|karioka|binatog|ginataang mais|roasted pumpkin seeds)\b/u.test(
      text
    ) ||
    (!savoryCake && /\bcakes?\b/u.test(text))
  );
}

/** A condiment or identified side needs a composed meal, not calorie scaling into a whole slot. */
export function isComponentOnlyRecipe(name: string, category?: string | null): boolean {
  const title = name.normalize('NFKC').toLowerCase().trim();
  const label = (category ?? '').normalize('NFKC').toLowerCase().trim();
  return (
    /^(?:recipe for )?(?:(?:asian|filipino vinegar|basic asian) dipping sauce|filipino vinegar dipping sauce|(?:barbecue chicken|flank steak) marinade)(?: recipe)?$/u.test(
      title
    ) ||
    /^how to (?:make (?:toasted garlic|mayonnaise)|caramelize onions)$/u.test(title) ||
    /^home fries(?: recipe)?$/u.test(title) ||
    /^steamed broccoli with toasted garlic and lemon$/u.test(title) ||
    /^boiled okra and eggplant with bagoong dipping sauce$/u.test(title) ||
    /^(?:condiment|garnish|marinade|dipping sauce)$/u.test(label)
  );
}

export function isStandaloneRecipe(name: string, category?: string | null): boolean {
  const text = `${name} ${category ?? ''}`.normalize('NFKC').toLowerCase();
  return (
    isSnackOnlyRecipe(name, category) ||
    /\b(?:snacks?|merienda|bread|pandesal|oatmeal|pancakes?|shakes?|salads?|sandwich(?:es)?|pasta|noodles?|pancit|bihon|sotanghon|misua|miki|spaghetti|macaroni|lasagna|sweet potato|pizza|burgers?|buns?|pies?|empanada|quesadilla|wraps?|tacos?|sauces?|condiment|dips?)\b/u.test(
      text
    )
  );
}
