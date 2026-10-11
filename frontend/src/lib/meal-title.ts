/** Display only: retain the source title for lookup, image matching and saved evidence. */
export function formatMealTitle(name: string): string {
  const title = name.trim();
  const display = title
    .replace(/^how\s+to\s+(?:make|cook|prepare)\s+/i, '')
    .replace(/\s*[-–—:]\s*(?:the\s+)?basic\s+recipe\s*$/i, '')
    .replace(/\s+recipe\s*$/i, '')
    .trim();
  return display || title;
}
