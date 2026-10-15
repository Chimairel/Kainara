/** Shared display/search precision; source measurements retain their original values. */
export const roundNutritionNumber = (value: number) => Math.round(value * 10) / 10;
export const formatNutritionNumber = (value: number) => roundNutritionNumber(value).toFixed(1);
