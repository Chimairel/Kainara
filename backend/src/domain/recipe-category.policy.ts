/** Recipe identity/category guards; ingredient sugar alone never makes an ulam a dessert. */
export function isSnackOnlyRecipe(name: string, category?: string | null): boolean {
  const text = `${name} ${category ?? ''}`.normalize('NFKC').toLowerCase();
  const savoryCake = /\b(?:fish|crab|salmon|tuna|potato) cakes?\b/u.test(text);
  return (
    /\b(?:desserts?|brownies?|blondies?|cupcakes?|cheesecakes?|cookies?|muffins?|doughnuts?|donuts?|macaroons?|mousse|cand(?:y|ies)|puddings?|puto|kutsinta|palitaw|suman|biko|bibingka|binignit|turon|maruya|bananaque|banana cue|kamote cue|espasol|maja blanca|ube halaya|pichi[ -]pichi|polvoron|pastillas|yema|ensaymada|hopia|bilo[ -]bilo|sapin[ -]sapin|leche flan|ice cream|halo[ -]halo|beverages?|drinks?|smoothies?|milkshakes?)\b/u.test(
      text
    ) ||
    (!savoryCake && /\bcakes?\b/u.test(text))
  );
}

export function isStandaloneRecipe(name: string, category?: string | null): boolean {
  const text = `${name} ${category ?? ''}`.normalize('NFKC').toLowerCase();
  return (
    isSnackOnlyRecipe(name, category) ||
    /\b(?:snacks?|merienda|bread|pandesal|oatmeal|pancakes?|shakes?|salads?|sandwich(?:es)?|pasta|noodles?|pancit|bihon|sotanghon|misua|miki|spaghetti|macaroni|lasagna|sweet potato)\b/u.test(
      text
    )
  );
}
