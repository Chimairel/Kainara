export function distribution(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  const percentile = (p: number) =>
    valid.length ? Math.round(valid[Math.max(0, Math.ceil(valid.length * p) - 1)]) : null;
  return {
    samples: valid.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: valid.length ? Math.round(valid[valid.length - 1]) : null,
  };
}

export function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((10000 * numerator) / denominator) / 100 : null;
}
