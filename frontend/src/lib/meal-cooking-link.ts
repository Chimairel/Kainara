export interface MealCookingLink {
  url: string;
  kind: 'PANLASANG_RECIPE' | 'SOURCE_VIDEO';
}

export function cookingAction(mealName: string, directLink?: MealCookingLink | null) {
  if (directLink?.kind === 'SOURCE_VIDEO') {
    let approved = false;
    try {
      const url = new URL(directLink.url);
      approved =
        url.protocol === 'https:' &&
        ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname) &&
        !url.username &&
        !url.password;
    } catch {
      /* Fall back to a YouTube search. */
    }
    if (approved)
      return {
        href: directLink.url,
        label: 'Watch Video',
        description: 'Watch the cooking video linked to this recipe.',
      };
  }
  return {
    href: `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to cook ${mealName}`)}`,
    label: 'Find on YouTube',
    description: 'Find cooking tutorials for this dish on YouTube.',
  };
}
