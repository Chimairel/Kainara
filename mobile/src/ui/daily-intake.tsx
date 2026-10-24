import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import type { dailyIntake } from '../lib/dashboard';
import { Copy, Icon } from './components';
import { fonts } from './theme';

const ink = '#eff8f3',
  muted = '#b3c9bf',
  green = '#10b981',
  cyan = '#38bdf8',
  orange = '#eb6a38';
export function DailyIntake({
  intake,
  unavailable,
  loading,
  waterMl,
  waterUnavailable,
  waterBusy,
  onWater,
  showWater,
  dayLabel = 'Today',
}: {
  intake: ReturnType<typeof dailyIntake>;
  unavailable: boolean;
  loading: boolean;
  waterMl: number;
  waterUnavailable: boolean;
  waterBusy: boolean;
  onWater(): void;
  showWater: boolean;
  dayLabel?: string;
}) {
  const { totals, targets } = intake;
  const fraction =
    targets.calories && targets.calories > 0 ? Math.min(1, Math.max(0, totals.calories / targets.calories)) : 0;
  const circumference = 2 * Math.PI * 54;
  const value = (amount: number | undefined, unit = '') =>
    amount === undefined ? 'Not recorded' : `${Math.round(amount).toLocaleString()}${unit}`;
  const text = { color: ink },
    secondary = { color: muted };
  const rows = [
    ['Protein', 'proteinG', green],
    ['Carbs', 'carbsG', cyan],
    ['Fat', 'fatG', orange],
  ] as const;
  return (
    <View
      style={{
        padding: 20,
        gap: 20,
        borderRadius: 24,
        backgroundColor: '#0e271f',
        borderColor: '#173e33',
        borderWidth: 1,
        overflow: 'hidden',
        boxShadow: '0px 8px 20px rgba(5,18,14,0.14)',
      }}
    >
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
        <Svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, right: 0 }}
          preserveAspectRatio="none"
          accessible={false}
        >
          <Defs>
            <RadialGradient id="intake" cx="100%" cy="0%" rx="100%" ry="80%">
              <Stop offset="0" stopColor="#1b4e41" />
              <Stop offset="1" stopColor="#0e271f" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#intake)" />
        </Svg>
      </View>
      <Svg
        width={108}
        height={108}
        viewBox="0 0 160 160"
        style={{ position: 'absolute', right: 0, top: 0 }}
        accessible={false}
      >
        <Path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill={orange} />
        <Path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
        <Path d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z" fill="#1b4e41" />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Copy small style={[secondary, { fontWeight: '600' }]}>
          Your daily intake
        </Copy>
        <View style={{ borderRadius: 14, backgroundColor: '#071914cc', paddingHorizontal: 10, paddingVertical: 2 }}>
          <Copy small style={{ color: '#f09e6c', fontSize: 10, fontWeight: '600' }}>
            {dayLabel}
          </Copy>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <View
          accessible
          accessibilityLabel={
            unavailable
              ? 'Intake unavailable'
              : loading
                ? 'Loading intake'
                : `${Math.round(fraction * 100)} percent of recorded calorie target consumed`
          }
          style={{ width: 126, height: 126, alignItems: 'center', justifyContent: 'center' }}
        >
          <Svg width={126} height={126} viewBox="0 0 126 126" style={{ position: 'absolute' }} accessible={false}>
            <Circle cx={63} cy={63} r={54} stroke="#ffffff20" strokeWidth={11} fill="none" />
            {!unavailable && !loading && fraction > 0 ? (
              <Circle
                cx={63}
                cy={63}
                r={54}
                stroke={green}
                strokeWidth={11}
                fill="none"
                strokeDasharray={[circumference * fraction, circumference]}
                strokeLinecap="round"
                rotation={-90}
                origin="63,63"
              />
            ) : null}
          </Svg>
          <Copy style={[text, { fontFamily: fonts.display, fontWeight: '800', fontSize: 32, lineHeight: 38 }]}>
            {unavailable || loading ? '—' : `${Math.round(fraction * 100)}%`}
          </Copy>
          <Copy small style={[secondary, { fontSize: 11 }]}>
            INTAKE
          </Copy>
        </View>
        <View style={{ flex: 1, minWidth: 105, gap: 12 }}>
          <View>
            <Copy small style={[secondary, { fontSize: 10, fontWeight: '700' }]}>
              CONSUMED
            </Copy>
            <Copy style={[text, { fontFamily: fonts.display, fontWeight: '700', fontSize: 22, lineHeight: 28 }]}>
              {unavailable ? 'Unavailable' : loading ? 'Checking…' : value(totals.calories, ' kcal')}
            </Copy>
          </View>
          <View>
            <Copy small style={[secondary, { fontSize: 10, fontWeight: '700' }]}>
              DAILY TARGET
            </Copy>
            <Copy style={[secondary, { fontFamily: fonts.display, fontWeight: '700', fontSize: 18 }]}>
              {value(targets.calories, ' kcal')}
            </Copy>
          </View>
          <Copy small style={{ color: '#10b981' }}>
            Logged for this day
          </Copy>
        </View>
      </View>
      <View style={{ gap: 18, borderTopColor: '#ffffff20', borderTopWidth: 1, paddingTop: 20 }}>
        {rows.map(([label, field, color]) => (
          <View
            key={field}
            accessible
            accessibilityLabel={`${label}: ${unavailable ? 'unavailable' : loading ? 'loading' : value(totals[field], ' grams')}, target ${value(targets[field], ' grams')}`}
            style={{ gap: 8 }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                <Copy style={text}>{label}</Copy>
              </View>
              <Copy small style={[secondary, { fontFamily: fonts.data }]}>
                {unavailable || loading ? '—' : value(totals[field], 'g')} / {value(targets[field], 'g')}
              </Copy>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: '#ffffff18', overflow: 'hidden' }}>
              <View
                style={{
                  height: 6,
                  backgroundColor: color,
                  width: `${!unavailable && !loading && targets[field] ? Math.min(100, Math.max(0, (totals[field] / targets[field]!) * 100)) : 0}%`,
                }}
              />
            </View>
          </View>
        ))}
      </View>
      {showWater ? (
        <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: '#ffffff20', paddingTop: 10 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View water history"
              onPress={() => router.push('/progress')}
              style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Icon name="water-outline" size={20} color={cyan} />
              <Copy style={[text, { textDecorationLine: 'underline' }]}>Water</Copy>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Copy small style={[secondary, { fontFamily: fonts.data }]}>
                {waterUnavailable ? 'Unavailable' : `${waterMl.toLocaleString()} mL`}
              </Copy>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add 250 mL of water"
                accessibilityState={{ disabled: waterUnavailable || waterBusy, busy: waterBusy }}
                disabled={waterUnavailable || waterBusy}
                onPress={onWater}
                style={({ pressed }) => ({
                  minHeight: 48,
                  minWidth: 48,
                  borderRadius: 16,
                  backgroundColor: '#10b98122',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: waterUnavailable || waterBusy ? 0.4 : pressed ? 0.6 : 1,
                })}
              >
                <Icon name="plus" size={22} color="#68e2bd" />
              </Pressable>
            </View>
          </View>
          <Copy small style={secondary}>
            Track what you drink. Individual fluid needs may differ.
          </Copy>
        </View>
      ) : null}
      {intake.incomplete ? (
        <Copy small style={secondary}>
          Some food logs have incomplete nutrition. Totals may exclude unknown values.
        </Copy>
      ) : null}
      {intake.provisional > 0 ? (
        <Copy small style={{ color: '#f09e6c' }}>
          {value(intake.provisional, ' kcal')} remains provisional.
        </Copy>
      ) : null}
      {!unavailable && !loading && targets.calories ? (
        <View
          style={{
            padding: 14,
            backgroundColor: '#07191480',
            borderRadius: 16,
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Copy small style={secondary}>
            Remaining budget
          </Copy>
          <Copy small style={{ color: '#68e2bd', fontWeight: '700' }}>
            {value(Math.max(0, targets.calories - totals.calories), ' kcal')}
          </Copy>
        </View>
      ) : null}
    </View>
  );
}
