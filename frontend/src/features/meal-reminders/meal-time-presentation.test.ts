import { describe, expect, it } from 'vitest';
import { reminderTimeLabel } from './meal-time-presentation';

describe('reminder time labels', () => {
  it('shows preparation and logging wall times with noon and midnight handled explicitly', () => {
    expect(reminderTimeLabel('22:24', -60)).toBe('9:24 PM');
    expect(reminderTimeLabel('22:24', 60)).toBe('11:24 PM');
    expect(reminderTimeLabel('11:00', 60)).toBe('12:00 PM');
    expect(reminderTimeLabel('23:00', 60)).toBe('12:00 AM (next day)');
    expect(reminderTimeLabel('05:00', -180)).toBe('2:00 AM');
    expect(reminderTimeLabel('22:24', 0)).toBe('10:24 PM');
    expect(reminderTimeLabel('00:30', -60)).toBe('11:30 PM (previous day)');
  });
  it('does not invent a reminder time for an empty or invalid draft', () => {
    for (const time of ['', '24:00', '10:60', '7:00']) expect(reminderTimeLabel(time, 60)).toBeNull();
    expect(reminderTimeLabel('22:24', NaN)).toBeNull();
    expect(reminderTimeLabel('22:24', 1.5)).toBeNull();
  });
});
