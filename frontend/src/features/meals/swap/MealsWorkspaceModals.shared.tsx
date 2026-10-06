import { useMealsWorkspace } from '../useMealsWorkspace';

export type Props = { workspace: ReturnType<typeof useMealsWorkspace> };
export type MiniSortOption = 'best_match' | 'kcal_match';
