export interface MealThemeConfig {
  cardBg: string;
  borderColor: string;
  shadow: string;
  hoverShadow: string;
  plateRim: string;
}

export const THEMES: Record<string, MealThemeConfig> = {
  BREAKFAST: {
    // Warm Terracotta Orange (Primary Brand Accent)
    cardBg:
      'bg-gradient-to-br from-[#eb6a38] via-[#e25c28] to-[#c74614] dark:from-[#8d3210] dark:via-[#752609] dark:to-[#571b05]',
    borderColor: 'border-[#f27e50]/40 dark:border-[#a63e17]/50',
    shadow:
      'shadow-[0_4px_16px_-3px_rgba(235,106,56,0.12),0_2px_6px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
    hoverShadow:
      'hover:shadow-[0_8px_22px_-4px_rgba(235,106,56,0.18),0_4px_10px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]',
    plateRim: 'border-2 border-[#ffeedd] dark:border-[#963713]',
  },
  LUNCH: {
    // Fresh Herbal Emerald (Brand Green)
    cardBg:
      'bg-gradient-to-br from-[#08705b] via-[#065e4c] to-[#044c3d] dark:from-[#083e33] dark:via-[#06332a] dark:to-[#04241d]',
    borderColor: 'border-[#129177]/40 dark:border-[#0e6351]/50',
    shadow:
      'shadow-[0_4px_16px_-3px_rgba(8,112,91,0.12),0_2px_6px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
    hoverShadow:
      'hover:shadow-[0_8px_22px_-4px_rgba(8,112,91,0.18),0_4px_10px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]',
    plateRim: 'border-2 border-[#e6f7f2] dark:border-[#0e6351]',
  },
  DINNER: {
    // Twilight Royal Indigo / Oceanic Spruce
    cardBg:
      'bg-gradient-to-br from-[#4f46e5] via-[#4338ca] to-[#3730a3] dark:from-[#2e265c] dark:via-[#241e4a] dark:to-[#1a1538]',
    borderColor: 'border-[#6b6bf1]/40 dark:border-[#4f46e5]/50',
    shadow:
      'shadow-[0_4px_16px_-3px_rgba(79,70,229,0.12),0_2px_6px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
    hoverShadow:
      'hover:shadow-[0_8px_22px_-4px_rgba(79,70,229,0.18),0_4px_10px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]',
    plateRim: 'border-2 border-[#ede9fe] dark:border-[#4338ca]',
  },
  SNACK: {
    // Spiced Berry Coral
    cardBg:
      'bg-gradient-to-br from-[#db4d6d] via-[#c43b5b] to-[#a62a48] dark:from-[#6b1e32] dark:via-[#541626] dark:to-[#3e0f1b]',
    borderColor: 'border-[#ea6383]/40 dark:border-[#8b2b44]/50',
    shadow:
      'shadow-[0_4px_16px_-3px_rgba(219,77,109,0.12),0_2px_6px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
    hoverShadow:
      'hover:shadow-[0_8px_22px_-4px_rgba(219,77,109,0.18),0_4px_10px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]',
    plateRim: 'border-2 border-[#ffe4e9] dark:border-[#8b2b44]',
  },
};

export function getMealTheme(mealType?: string | null, index = 0): MealThemeConfig {
  const norm = (mealType || '').toUpperCase();
  if (norm.includes('BREAKFAST')) return THEMES.BREAKFAST;
  if (norm.includes('LUNCH')) return THEMES.LUNCH;
  if (norm.includes('DINNER')) return THEMES.DINNER;
  if (norm.includes('SNACK')) return THEMES.SNACK;
  const list = [THEMES.BREAKFAST, THEMES.LUNCH, THEMES.DINNER, THEMES.SNACK];
  return list[index % list.length];
}
