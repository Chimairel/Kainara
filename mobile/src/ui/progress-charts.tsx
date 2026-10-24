import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import type { Progress } from '../lib/contracts';
import { dateLabel } from '../lib/policies';
import { Copy, Divider, Panel, SelectField } from './components';
import { fonts, useTheme } from './theme';

export function WeightChart({ rows, target }: { rows: Progress['weightLogs']; target?: number }) {
  const theme = useTheme();
  const [range, setRange] = useState('week');
  const [now] = useState(() => Date.now());
  const days = range === 'week' ? 7 : range === 'month' ? 30 : Infinity;
  const points = rows
    .filter((row) => Date.parse(row.loggedAt) >= now - days * 86400000)
    .slice()
    .sort((a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt));
  const values = [...points.map((row) => row.weightKg), ...(target ? [target] : [])];
  const min = Math.min(...values) - 1,
    max = Math.max(...values) + 1;
  const start = points.length ? Date.parse(points[0].loggedAt) : 0,
    end = points.length ? Date.parse(points.at(-1)!.loggedAt) : 0;
  const x = (date: string) => (end === start ? 170 : 25 + ((Date.parse(date) - start) / (end - start)) * 290);
  const y = (value: number) => 145 - ((value - min) / (max - min)) * 120;
  return (
    <Panel>
      <Copy style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: '700' }}>Weight Progress</Copy>
      <Copy small muted>
        {target ? `Target: ${target} kg · ` : ''}Real observations over time.
      </Copy>
      <SelectField
        label="Weight history range"
        value={range}
        onChange={setRange}
        options={[
          ['week', 'Weekly Progress'],
          ['month', 'Monthly Progress'],
          ['all', 'All entries'],
        ]}
      />
      {points.length ? (
        <>
          <Svg width="100%" height={170} viewBox="0 0 340 170" accessible={false}>
            {[25, 85, 145].map((line) => (
              <Line key={line} x1={20} y1={line} x2={320} y2={line} stroke={theme.border} />
            ))}
            {target ? (
              <Line x1={20} y1={y(target)} x2={320} y2={y(target)} stroke={theme.primary} strokeDasharray="5,5" />
            ) : null}
            {points.length > 1 ? (
              <Polyline
                points={points.map((row) => `${x(row.loggedAt)},${y(row.weightKg)}`).join(' ')}
                fill="none"
                stroke={theme.green}
                strokeWidth={3}
              />
            ) : null}
            {points.map((row) => (
              <Circle key={row.id} cx={x(row.loggedAt)} cy={y(row.weightKg)} r={5} fill={theme.green} />
            ))}
          </Svg>
          {points.map((row) => (
            <View
              key={row.id}
              accessible
              accessibilityLabel={`${dateLabel(row.loggedAt)}: ${row.weightKg} kilograms`}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
            >
              <Copy small muted>
                {dateLabel(row.loggedAt)}
              </Copy>
              <Copy small style={{ fontWeight: '600' }}>
                {row.weightKg} kg
              </Copy>
            </View>
          ))}
        </>
      ) : (
        <Copy muted>No weigh-ins in this period.</Copy>
      )}
    </Panel>
  );
}

export function WaterChart({ days }: { days: NonNullable<Progress['waterHistory']>['days'] }) {
  const theme = useTheme();
  const [date, setDate] = useState<string | null>(null);
  const selected = days.find((day) => day.date === date) ?? days.at(-1);
  const scale = Math.max(250, Math.ceil(Math.max(0, ...days.map((day) => day.totalMl)) / 250) * 250);
  return (
    <Panel>
      <Copy style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: '700' }}>Water history</Copy>
      <Copy muted>
        Your logged water over the last 7 days. Select a day to see its entries. Dates follow Philippine time.
      </Copy>
      <Copy small muted>
        Logged water · mL · Chart maximum: {scale.toLocaleString()}
      </Copy>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {days.map((day) => (
          <Pressable
            key={day.date}
            accessibilityRole="button"
            accessibilityLabel={`${dateLabel(day.date)}: ${day.totalMl} mL`}
            accessibilityState={{ selected: selected?.date === day.date }}
            onPress={() => setDate(day.date)}
            style={{
              flex: 1,
              minHeight: 48,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: selected?.date === day.date ? theme.greenSoft : 'transparent',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                height: 128,
                width: '100%',
                justifyContent: 'flex-end',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: day.totalMl > 0 ? Math.max(3, (day.totalMl / scale) * 128) : 3,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  backgroundColor:
                    day.totalMl > 0 ? (selected?.date === day.date ? theme.green : theme.carbs) : theme.border,
                }}
              />
            </View>
            <Copy small style={{ fontSize: 10 }}>
              {new Date(`${day.date}T12:00:00+08:00`).toLocaleDateString('en-PH', {
                weekday: 'short',
                timeZone: 'Asia/Manila',
              })}
            </Copy>
            <Copy small>{Number(day.date.slice(-2))}</Copy>
          </Pressable>
        ))}
      </View>
      <Divider />
      {selected ? (
        <View style={{ gap: 10 }}>
          <Copy style={{ fontWeight: '600' }}>
            {dateLabel(selected.date)} ·{' '}
            {selected.totalMl ? `${selected.totalMl.toLocaleString()} mL logged` : 'No log'}
          </Copy>
          {selected.entries?.length ? (
            selected.entries.map((entry) => (
              <View key={entry.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Copy small muted>
                  {new Date(entry.loggedAt).toLocaleTimeString('en-PH', {
                    timeZone: 'Asia/Manila',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Copy>
                <Copy small>{entry.amountMl} mL</Copy>
              </View>
            ))
          ) : (
            <Copy small muted>
              {selected.totalMl ? 'Saved entry details are not available.' : 'No water was logged on this day.'}
            </Copy>
          )}
        </View>
      ) : (
        <Copy muted>Water history is unavailable. Refresh Progress to try again.</Copy>
      )}
    </Panel>
  );
}
