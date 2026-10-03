import { describe, expect, it } from 'vitest';
import { groupWeightObservations } from './weight-chart-data';

const baseline = { weightKg: 57, loggedAt: '2026-10-04T02:00:00Z', source: 'ONBOARDING' };
describe('starting weight in the progress chart', () => {
  it('shows a single actual starting observation without fabricating a trend', () => {
    expect(groupWeightObservations([baseline], 'week')).toEqual([{ ...baseline, dateLabel: 'Starting weight' }]);
  });
  for (const timeframe of ['week', 'month', 'year'] as const) {
    it(`preserves starting weight separately from ${timeframe} averages and orders follow-ups after it`, () => {
      const points = groupWeightObservations(
        [
          { weightKg: 61, loggedAt: '2026-10-06T02:00:00Z' },
          baseline,
          { weightKg: 59, loggedAt: '2026-10-05T02:00:00Z' },
        ],
        timeframe
      );
      expect(points.map((point) => point.weightKg)).toEqual([57, 60]);
      expect(points[0]).toMatchObject(baseline);
      expect(Date.parse(points[1].loggedAt)).toBeGreaterThan(Date.parse(points[0].loggedAt));
    });
  }
  it('labels a recovered report baseline and preserves existing grouping without a baseline', () => {
    expect(groupWeightObservations([{ ...baseline, source: 'INITIAL_REPORT' }], 'month')[0].source).toBe(
      'INITIAL_REPORT'
    );
    expect(
      groupWeightObservations(
        [
          { weightKg: 58, loggedAt: '2026-10-05T02:00:00Z' },
          { weightKg: 60, loggedAt: '2026-10-06T02:00:00Z' },
        ],
        'week'
      ).map((point) => point.weightKg)
    ).toEqual([59]);
    expect(groupWeightObservations([], 'week')).toEqual([]);
  });
});
