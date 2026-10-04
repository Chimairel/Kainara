'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';
import type { useProgressWorkspace } from './useProgressWorkspace';

type WeightGraphProps = Pick<ReturnType<typeof useProgressWorkspace>, 'groupedLogs' | 'targetWeight'>;

export function getTimeScaleRatios(loggedAt: string[]): number[] {
  const timestamps = loggedAt.map((value) => new Date(value).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  return timestamps.map((timestamp) => (maxTime > minTime ? (timestamp - minTime) / (maxTime - minTime) : 0.5));
}

/**
 * Creates a smooth cubic bezier path for an array of 2D points.
 */
function createSmoothCurve(points: { x: number; y: number }[]): string {
  if (points.length <= 1) return '';
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const tension = 6;
    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function WeightGraph({ groupedLogs, targetWeight }: WeightGraphProps) {
  if (groupedLogs.length === 0) {
    return (
      <div className="flex flex-col h-56 items-center justify-center border border-dashed border-brand-border/80 rounded-2xl bg-brand-surface/20 text-brand-muted text-xs font-semibold p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-brand-green/10 flex items-center justify-center mb-3">
          <TrendingUp className="w-5 h-5 text-brand-green" />
        </div>
        <span className="text-sm font-bold text-brand-text mb-1">No weight logs recorded yet</span>
        <span>Log your weight to generate progress graphs</span>
      </div>
    );
  }

  // Graph Dimensions
  const width = 600;
  const height = 230;
  const paddingLeft = 45;
  const paddingRight = 35;
  const paddingTop = 32;
  const paddingBottom = 48;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // Resolve min/max weights for scale
  const weights = groupedLogs.map((log) => log.weightKg);
  if (targetWeight > 0) {
    weights.push(targetWeight);
  }
  const minRaw = Math.min(...weights);
  const maxRaw = Math.max(...weights);
  const minW = Math.max(0, Math.floor(minRaw - 2));
  const maxW = Math.ceil(maxRaw + 2);
  const rangeW = maxW - minW || 10;

  // 4 Horizontal Grid Lines with clean labels
  const gridSteps = 4;
  const gridTicks = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const w = minW + (rangeW * i) / gridSteps;
    const y = height - paddingBottom - ((w - minW) / rangeW) * plotHeight;
    return {
      weight: Math.round(w),
      y,
    };
  });

  // Map logs to coordinates
  const timeRatios = getTimeScaleRatios(groupedLogs.map((log) => log.loggedAt));
  const points = groupedLogs.map((log, index) => {
    const ratio = timeRatios[index];
    const x = paddingLeft + ratio * plotWidth;
    const y = height - paddingBottom - ((log.weightKg - minW) / rangeW) * plotHeight;
    return { x, y, weight: log.weightKg, date: log.dateLabel };
  });

  // Create Path commands (smooth curve)
  let linePath = '';
  let areaPath = '';
  if (points.length > 1) {
    linePath = createSmoothCurve(points);
    const baselineY = height - paddingBottom;
    areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baselineY} L ${points[0].x.toFixed(1)} ${baselineY} Z`;
  }

  const targetY =
    targetWeight > 0 ? height - paddingBottom - ((targetWeight - minW) / rangeW) * plotHeight : -1;
  const isTargetVisible = targetWeight > 0 && targetY >= paddingTop && targetY <= height - paddingBottom;

  const baseline = groupedLogs.find((log) => log.source === 'ONBOARDING' || log.source === 'INITIAL_REPORT');

  const firstWeight = groupedLogs[0]?.weightKg;
  const latestWeight = groupedLogs[groupedLogs.length - 1]?.weightKg;
  const delta = latestWeight !== undefined && firstWeight !== undefined ? latestWeight - firstWeight : 0;
  const deltaText =
    delta === 0 ? '0.0 kg' : delta > 0 ? `+${delta.toFixed(1)} kg` : `${delta.toFixed(1)} kg`;

  return (
    <div className="w-full rounded-2xl border border-brand-border/70 bg-gradient-to-b from-brand-surface to-brand-bgAlt/30 p-4 sm:p-5 shadow-xs relative overflow-hidden">
      {/* Ambient soft glow orbs */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-brand-green/5 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-accent/5 blur-3xl pointer-events-none rounded-full" />

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="Weight progress chart"
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-green)" stopOpacity="0.22" />
            <stop offset="60%" stopColor="var(--brand-green)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--brand-green)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand-green)" />
            <stop offset="100%" stopColor="var(--brand-cyan)" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines & Y-axis labels */}
        {gridTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={tick.y}
              x2={width - paddingRight}
              y2={tick.y}
              stroke="var(--brand-border)"
              strokeDasharray={i === 0 ? undefined : '3 4'}
              strokeOpacity={i === 0 ? 0.7 : 0.35}
              strokeWidth={i === 0 ? 1.2 : 1}
            />
            <text
              x={paddingLeft - 8}
              y={tick.y + 3}
              fill="var(--brand-muted)"
              fontSize="8.5"
              fontWeight="600"
              textAnchor="end"
              className="select-none"
            >
              {tick.weight}
            </text>
          </g>
        ))}

        {/* Target Weight Baseline */}
        {isTargetVisible && (
          <g>
            <line
              x1={paddingLeft}
              y1={targetY}
              x2={width - paddingRight - 88}
              y2={targetY}
              stroke="var(--brand-accent)"
              strokeDasharray="5 4"
              strokeWidth="1.5"
              strokeOpacity="0.75"
            />
            {/* Target Badge Pill */}
            <rect
              x={width - paddingRight - 84}
              y={targetY - 10}
              width="84"
              height="20"
              rx="6"
              fill="var(--brand-surface)"
              stroke="var(--brand-accent)"
              strokeWidth="1.2"
              strokeOpacity="0.8"
            />
            <text
              x={width - paddingRight - 42}
              y={targetY + 3.5}
              fill="var(--brand-accent)"
              fontSize="8.5"
              fontWeight="bold"
              textAnchor="middle"
              className="select-none"
            >
              Target: {targetWeight} kg
            </text>
          </g>
        )}

        {/* Filled Area */}
        {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

        {/* Stroke Line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Graph Nodes */}
        {points.map((p, idx) => {
          const pillY = p.y - 28 < paddingTop ? p.y + 12 : p.y - 26;
          const textY = pillY + 12;

          return (
            <g key={idx} className="group">
              {/* Vertical Guide to X-axis */}
              <line
                x1={p.x}
                y1={p.y}
                x2={p.x}
                y2={height - paddingBottom}
                stroke="var(--brand-green)"
                strokeDasharray="2 3"
                strokeOpacity="0.25"
                strokeWidth="1"
              />

              {/* Floating Weight Badge */}
              <rect
                x={p.x - 22}
                y={pillY}
                width="44"
                height="18"
                rx="6"
                fill="var(--brand-surface)"
                stroke="var(--brand-border)"
                strokeWidth="1.2"
                className="transition-colors group-hover:stroke-brand-green"
              />
              <text
                x={p.x}
                y={textY}
                fill="var(--brand-text)"
                fontSize="8.5"
                fontWeight="800"
                textAnchor="middle"
                className="select-none"
              >
                {p.weight} kg
              </text>

              {/* Node Circle (Exactly 1 per point) */}
              <circle
                cx={p.x}
                cy={p.y}
                r="5.5"
                fill="var(--brand-surface)"
                stroke="var(--brand-green)"
                strokeWidth="3"
                className="transition-all duration-200 cursor-pointer group-hover:r-7"
              />

              {/* Date Label at X-axis */}
              <text
                x={p.x}
                y={height - paddingBottom + 15}
                fill="var(--brand-muted)"
                fontSize="8"
                fontWeight="700"
                textAnchor="middle"
                className="select-none"
              >
                {p.date}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Baseline & Summary Info Footer */}
      {baseline && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-brand-border/60 pt-3 text-xs text-brand-muted">
          <p>
            Starting weight: {baseline.weightKg} kg ·{' '}
            {baseline.source === 'ONBOARDING' ? 'From onboarding' : 'From your first saved report'}
            {' · '}
            {new Date(baseline.loggedAt).toLocaleDateString()}.
            {groupedLogs.length === 1 && ' Log your next weight to see the trend.'}
          </p>
          {groupedLogs.length > 1 && (
            <div className="flex items-center gap-2 font-bold shrink-0">
              <span className="text-[11px] text-brand-muted">Net change:</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  delta > 0
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : delta < 0
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-brand-surface text-brand-muted'
                }`}
              >
                <span>{delta > 0 ? '↑' : delta < 0 ? '↓' : '•'}</span>
                <span>{deltaText}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
