/** Display only: retain the source title for lookup, image matching and saved evidence. */
export function formatMealTitle(name: string): string {
  const title = name.trim();
  return title.replace(/\s+recipe\s*$/i, '').trim() || title;
}
