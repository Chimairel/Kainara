/** Display only: retain the source title for lookup, image matching and saved evidence. */
export function formatMealTitle(name: string): string {
  const title = name.trim();
  const display = title
    .replace(/^how\s+to\s+(?:make|cook|prepare)\s+(?:(?:a|the)\s+)?/i, '')
    .replace(
      /^how\s+to\s+(grill|bake|poach|can|caramelize)\s+/i,
      (_, verb: string) =>
        ({ grill: 'Grilled ', bake: 'Baked ', poach: 'Poached ', can: 'Canned ', caramelize: 'Caramelized ' })[
          verb.toLowerCase()
        ] || ''
    )
    .replace(/^making\s+the\s+perfect\s+/i, '')
    .replace(/^recipe\s+for\s+/i, '')
    .replace(/\s*[-–—:]\s*(?:the\s+)?basic\s+recipes?\s*$/i, '')
    // Remove article wording without rewriting stored recipe identities.
    .replace(/(\S)\s+recipes?\b/gi, '$1')
    .replace(
      /^(?:(?:quick\s+and\s+easy|super\s+easy|most\s+delicious|easy|amazing|delicious|yummy|best|perfect|quick)\s+)+/i,
      ''
    )
    .replace(/\band\s+easy\s+/i, 'and ')
    .replace(/^no\s+steam\s+easy\s+/i, 'No Steam ')
    .replace(/\bone\s+delicious\s+/i, 'one ')
    .replace(/^simple\s+(?!syrup\b)/i, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return display || title;
}
