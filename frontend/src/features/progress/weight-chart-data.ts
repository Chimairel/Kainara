export interface WeightObservation {
  weightKg: number;
  loggedAt: string;
  source?: string;
}

export interface WeightChartPoint {
  weightKg: number;
  loggedAt: string;
  dateLabel: string;
  source?: string;
}

export function groupWeightObservations(
  observations: WeightObservation[],
  timeframe: 'week' | 'month' | 'year'
): WeightChartPoint[] {
  const logs = [...observations].sort((a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt));
  const baseline = logs.find((log) => log.source === 'ONBOARDING' || log.source === 'INITIAL_REPORT');
  const groups = new Map<number, { sum: number; count: number; firstAt: string }>();
  for (const log of logs) {
    if (log === baseline) continue;
    const date = new Date(log.loggedAt);
    if (timeframe === 'week') date.setDate(date.getDate() - date.getDay());
    else if (timeframe === 'month') date.setDate(1);
    else date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
    const key = date.getTime();
    const group = groups.get(key) ?? { sum: 0, count: 0, firstAt: log.loggedAt };
    group.sum += log.weightKg;
    group.count++;
    groups.set(key, group);
  }

  const points: WeightChartPoint[] = baseline ? [{ ...baseline, dateLabel: 'Starting weight' }] : [];
  for (const [key, group] of [...groups.entries()].sort(([a], [b]) => a - b)) {
    const date = new Date(key);
    const dateLabel =
      timeframe === 'week'
        ? `Wk of ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
        : timeframe === 'month'
          ? date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
          : date.getFullYear().toString();
    points.push({
      weightKg: Math.round((group.sum / group.count) * 10) / 10,
      dateLabel,
      // A same-period follow-up belongs after the starting observation, not at the earlier bucket boundary.
      loggedAt: baseline && key <= Date.parse(baseline.loggedAt) ? group.firstAt : date.toISOString(),
    });
  }
  return points.sort((a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt));
}
