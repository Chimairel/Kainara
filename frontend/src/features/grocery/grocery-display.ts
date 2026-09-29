import type { GroceryItem } from './current-grocery';

export interface FormattedGroceryDisplay {
  cleanName: string;
  prepNote: string | null;
  displayQuantity: string;
  recipeBadge: string;
  isMeasured: boolean;
}

// Map common decimal fractions to clean typographic fractions
function formatFraction(val: number): string {
  if (val <= 0) return '0';
  const whole = Math.floor(val);
  const remainder = val - whole;

  let fraction = '';
  if (remainder >= 0.1 && remainder < 0.2) fraction = '⅛';
  else if (remainder >= 0.2 && remainder < 0.3) fraction = '¼';
  else if (remainder >= 0.3 && remainder < 0.4) fraction = '⅓';
  else if (remainder >= 0.4 && remainder < 0.6) fraction = '½';
  else if (remainder >= 0.6 && remainder < 0.7) fraction = '⅔';
  else if (remainder >= 0.7 && remainder < 0.85) fraction = '¾';
  else if (remainder >= 0.85) return `${whole + 1}`;

  if (whole > 0 && fraction) return `${whole} ${fraction}`;
  if (whole > 0) return `${whole}`;
  return fraction || `${Math.round(val * 100) / 100}`;
}

export function formatGroceryItemDisplay(item: GroceryItem): FormattedGroceryDisplay {
  let name = item.ingredientName.trim();
  let prepNote: string | null = null;
  let parsedQty: number | null = item.quantity;
  let parsedUnit: string | null = item.unit;

  // 1. Handle cases where the title is an inverted parenthesized note e.g. "(hard boiled, sliced or wedged)"
  // and the unit is actually the ingredient like "eggs"
  if (name.startsWith('(') && name.endsWith(')')) {
    const inside = name.slice(1, -1).trim();
    if (item.unit && /^[a-zA-Z\s]+$/.test(item.unit) && !['cup', 'tbsp', 'tsp', 'g', 'kg', 'ml', 'l', 'oz', 'lb'].includes(item.unit.toLowerCase())) {
      name = item.unit.charAt(0).toUpperCase() + item.unit.slice(1);
      prepNote = inside;
      parsedUnit = 'pc';
    } else {
      name = inside;
    }
  }

  // 2. Extract leading quantity/measurement embedded in ingredientName
  // e.g. "1/2 cup cheddar cheese (grated)" or "2.5 ounces condensed soup"
  const embeddedQtyMatch = name.match(
    /^(\d+(?:\/\d+)?|\d*\.?\d+)\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?|pieces?|pcs?|cans?|packs?|packages?|bottles?|pinches?|pinch|lbs?|ounces?|oz|g|kg|ml|l)\.?\s*(?:of\s+)?(.*)$/i
  );
  if (embeddedQtyMatch && (!parsedQty || parsedQty <= 0)) {
    const qtyStr = embeddedQtyMatch[1];
    const unitStr = embeddedQtyMatch[2];
    name = embeddedQtyMatch[3].trim();

    if (qtyStr.includes('/')) {
      const [num, den] = qtyStr.split('/').map(Number);
      parsedQty = den ? num / den : 1;
    } else {
      parsedQty = parseFloat(qtyStr);
    }
    parsedUnit = unitStr;
  }

  // 3. Extract trailing parenthesized prep notes
  // e.g. "Cheddar cheese (cubed)" -> cleanName: "Cheddar cheese", prepNote: "cubed"
  const trailingParenMatch = name.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (trailingParenMatch && !prepNote) {
    name = trailingParenMatch[1].trim();
    prepNote = trailingParenMatch[2].trim();
  }

  // Capitalize first letter of clean name
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  // 4. Format sensible display quantity
  let displayQuantity = 'As needed';
  const isMeasured = parsedQty !== null && parsedQty > 0;

  if (isMeasured && parsedQty !== null) {
    const unit = (parsedUnit || '').trim().toLowerCase();

    // Convert large gram/ml amounts to kg/L for readability
    if (unit === 'g' && parsedQty >= 1000) {
      displayQuantity = `${Math.round((parsedQty / 1000) * 10) / 10} kg`;
    } else if (unit === 'ml' && parsedQty >= 1000) {
      displayQuantity = `${Math.round((parsedQty / 1000) * 10) / 10} L`;
    } else if (['piece', 'pieces', 'pc', 'pcs', 'egg', 'eggs'].includes(unit)) {
      // Discrete units round to nearest whole number if near zero or fractional
      const count = Math.max(1, Math.ceil(parsedQty));
      displayQuantity = `${count} ${count === 1 ? 'pc' : 'pcs'}`;
    } else if (unit) {
      displayQuantity = `${formatFraction(parsedQty)} ${unit}`;
    } else {
      displayQuantity = formatFraction(parsedQty);
    }
  }

  // 5. Recipe usage label
  const mealCount = item.sourceMealCount || 1;
  const recipeBadge = mealCount === 1 ? 'Used in 1 meal' : `Used in ${mealCount} meals`;

  return {
    cleanName: name || item.ingredientName,
    prepNote,
    displayQuantity,
    recipeBadge,
    isMeasured,
  };
}

export function getCategoryStyle(category: string): {
  colorClasses: string;
  badgeBg: string;
  iconName: 'produce' | 'meat' | 'seafood' | 'dairy' | 'grains' | 'pantry' | 'beverage' | 'other';
} {
  const normalized = category.toLowerCase();

  if (
    normalized.includes('produce') ||
    normalized.includes('vegetable') ||
    normalized.includes('fruit') ||
    normalized.includes('herb')
  ) {
    return {
      colorClasses: 'text-emerald-700 dark:text-emerald-300',
      badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      iconName: 'produce',
    };
  }

  if (
    normalized.includes('meat') ||
    normalized.includes('poultry') ||
    normalized.includes('pork') ||
    normalized.includes('beef') ||
    normalized.includes('chicken')
  ) {
    return {
      colorClasses: 'text-rose-700 dark:text-rose-300',
      badgeBg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
      iconName: 'meat',
    };
  }

  if (normalized.includes('fish') || normalized.includes('seafood') || normalized.includes('shrimp')) {
    return {
      colorClasses: 'text-sky-700 dark:text-sky-300',
      badgeBg: 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400',
      iconName: 'seafood',
    };
  }

  if (normalized.includes('dairy') || normalized.includes('egg') || normalized.includes('cheese') || normalized.includes('milk')) {
    return {
      colorClasses: 'text-amber-700 dark:text-amber-300',
      badgeBg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
      iconName: 'dairy',
    };
  }

  if (
    normalized.includes('grain') ||
    normalized.includes('rice') ||
    normalized.includes('cereal') ||
    normalized.includes('pasta') ||
    normalized.includes('noodle') ||
    normalized.includes('bread')
  ) {
    return {
      colorClasses: 'text-yellow-700 dark:text-yellow-300',
      badgeBg: 'bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
      iconName: 'grains',
    };
  }

  if (normalized.includes('beverage') || normalized.includes('drink') || normalized.includes('juice') || normalized.includes('water')) {
    return {
      colorClasses: 'text-cyan-700 dark:text-cyan-300',
      badgeBg: 'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
      iconName: 'beverage',
    };
  }

  if (
    normalized.includes('pantry') ||
    normalized.includes('spice') ||
    normalized.includes('condiment') ||
    normalized.includes('oil') ||
    normalized.includes('sauce')
  ) {
    return {
      colorClasses: 'text-orange-700 dark:text-orange-300',
      badgeBg: 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
      iconName: 'pantry',
    };
  }

  return {
    colorClasses: 'text-teal-700 dark:text-teal-300',
    badgeBg: 'bg-brand-green/10 text-brand-green',
    iconName: 'other',
  };
}
