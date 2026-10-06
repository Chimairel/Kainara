import type { MealHistoryLog } from '@/features/meals/useMealsWorkspace';
export type ActivityTimeRange = 'Year' | 'Month' | 'Week';
export interface MonthColumnData {
  year: number;
  monthIndex: number;
  name: string;
  fullLabel: string;
  isFuture: boolean;
  isCurrent: boolean;
  activeDaysCount: number;
  weeks: (DayCell | null)[][];
}
export interface MealActivityCalendarProps {
  logs: MealHistoryLog[];
  selectedDateKey: string | null;
  onSelectDateKey: (dateKey: string) => void;
  className?: string;
}
export interface DayCell {
  dateKey: string;
  date: Date;
  dayOfWeek: number; // 0 = Sun, 6 = Sat
  monthName: string;
  isCurrentMonth: boolean;
  mealCount: number;
  totalCalories: number;
  isToday: boolean;
  isFuture: boolean;
  isOutOfBounds?: boolean;
}
