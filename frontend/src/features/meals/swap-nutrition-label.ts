import type { SwapNutritionMatch } from './meals-workspace.types';

export function swapNutritionLabel(match?: SwapNutritionMatch) {
  switch (match) {
    case 'CLOSE':
      return 'Close daily macro match';
    case 'GAPS_REMAIN':
      return 'Daily macro gaps remain';
    case 'PARTIAL_DAY':
      return 'Partial day — match is provisional';
    default:
      return 'Nutrition match unavailable';
  }
}
