/** All search terms must occur in the meal name or recorded ingredient names. */
export function matchesReviewMealSearch(search: string | undefined, mealName: string, ingredients: readonly string[]) {
  const normalize = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const terms = normalize(search ?? '').trim().split(/\s+/).filter(Boolean);
  const text = normalize([mealName, ...ingredients].join(' '));
  return terms.every(term => text.includes(term));
}
