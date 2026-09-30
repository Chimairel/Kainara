export interface MealBannerTheme {
  bannerBg: string;
  plateBorder: string;
  shadow: string;
  hoverShadow: string;
}

export const BANNER_THEMES: Record<string, MealBannerTheme> = {
  BREAKFAST: {
    bannerBg:
      'bg-gradient-to-br from-[#eb6a38] via-[#e25c28] to-[#c74614] dark:from-[#8d3210] dark:via-[#752609] dark:to-[#571b05]',
    plateBorder: 'border border-white/80 dark:border-white/20',
    shadow:
      'shadow-[0_4px_16px_-3px_rgba(235,106,56,0.12),0_2px_6px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
    hoverShadow:
      'hover:shadow-[0_8px_22px_-4px_rgba(235,106,56,0.18),0_4px_10px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]',
  },
  LUNCH: {
    bannerBg:
      'bg-gradient-to-br from-[#08705b] via-[#065e4c] to-[#044c3d] dark:from-[#083e33] dark:via-[#06332a] dark:to-[#04241d]',
    plateBorder: 'border border-white/80 dark:border-white/20',
    shadow:
      'shadow-[0_4px_16px_-3px_rgba(8,112,91,0.12),0_2px_6px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
    hoverShadow:
      'hover:shadow-[0_8px_22px_-4px_rgba(8,112,91,0.18),0_4px_10px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]',
  },
  DINNER: {
    bannerBg:
      'bg-gradient-to-br from-[#4f46e5] via-[#4338ca] to-[#3730a3] dark:from-[#2e265c] dark:via-[#241e4a] dark:to-[#1a1538]',
    plateBorder: 'border border-white/80 dark:border-white/20',
    shadow:
      'shadow-[0_4px_16px_-3px_rgba(79,70,229,0.12),0_2px_6px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
    hoverShadow:
      'hover:shadow-[0_8px_22px_-4px_rgba(79,70,229,0.18),0_4px_10px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]',
  },
  SNACK: {
    bannerBg:
      'bg-gradient-to-br from-[#db4d6d] via-[#c43b5b] to-[#a62a48] dark:from-[#6b1e32] dark:via-[#541626] dark:to-[#3e0f1b]',
    plateBorder: 'border border-white/80 dark:border-white/20',
    shadow:
      'shadow-[0_4px_16px_-3px_rgba(219,77,109,0.12),0_2px_6px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
    hoverShadow:
      'hover:shadow-[0_8px_22px_-4px_rgba(219,77,109,0.18),0_4px_10px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]',
  },
};

export function getMealBannerTheme(mealType?: string, index = 0): MealBannerTheme {
  const norm = (mealType || '').toUpperCase();
  if (norm.includes('BREAKFAST')) return BANNER_THEMES.BREAKFAST;
  if (norm.includes('LUNCH')) return BANNER_THEMES.LUNCH;
  if (norm.includes('DINNER')) return BANNER_THEMES.DINNER;
  if (norm.includes('SNACK')) return BANNER_THEMES.SNACK;
  const list = [BANNER_THEMES.BREAKFAST, BANNER_THEMES.LUNCH, BANNER_THEMES.DINNER, BANNER_THEMES.SNACK];
  return list[index % list.length];
}
