import React from 'react';
import { Image, Pressable, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import type { Meal } from '../lib/contracts';
import { Copy, Icon } from './components';
import { fonts, useTheme } from './theme';
import { finite, mealDone, safeExternalUrl } from '../lib/policies';

export function Macros({
  meal,
}: {
  meal: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    nutritionCompleteness?: string;
    provisionalCalories?: number;
  };
}) {
  return (
    <View style={{ gap: 5 }}>
      <Copy style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>{Math.round(finite(meal.calories))} kcal</Copy>
      <Copy small muted>
        {Math.round(finite(meal.proteinG))} g protein · {Math.round(finite(meal.carbsG))} g carbs ·{' '}
        {Math.round(finite(meal.fatG))} g fat
      </Copy>
      {meal.nutritionCompleteness && meal.nutritionCompleteness !== 'COMPLETE' ? (
        <Copy small muted>
          Nutrition is incomplete. Shown totals may exclude unknown values.
        </Copy>
      ) : null}
      {finite(meal.provisionalCalories) > 0 ? (
        <Copy small muted>
          {Math.round(finite(meal.provisionalCalories))} kcal remains provisional.
        </Copy>
      ) : null}
    </View>
  );
}

const mealColors: Record<string, { light: [string, string]; dark: [string, string] }> = {
  BREAKFAST: { light: ['#e25c28', '#bc3e10'], dark: ['#8d3210', '#571b05'] },
  LUNCH: { light: ['#08705b', '#044c3d'], dark: ['#083e33', '#04241d'] },
  DINNER: { light: ['#4f46e5', '#3730a3'], dark: ['#2e265c', '#1a1538'] },
  SNACK: { light: ['#c43b5b', '#a62a48'], dark: ['#6b1e32', '#3e0f1b'] },
};

/** The web dashboard's colored meal surface and round plate, with native stack navigation. */
export function MealRow({ meal, preview = false }: { meal: Meal; preview?: boolean }) {
  const theme = useTheme();
  const url = meal.image?.url ? safeExternalUrl(meal.image.url) : null;
  const colors = (mealColors[meal.mealType?.toUpperCase()] ?? mealColors.LUNCH)[theme.isDark ? 'dark' : 'light'];
  const contents = (
    <View
      style={{
        borderRadius: 24,
        backgroundColor: colors[1],
        padding: 18,
        gap: 14,
        overflow: 'hidden',
        boxShadow: '0px 4px 12px rgba(5,18,14,0.1)',
      }}
    >
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
        <Svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0 }}
          preserveAspectRatio="none"
          accessible={false}
        >
          <Defs>
            <LinearGradient id="meal" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0" stopColor={colors[0]} />
              <Stop offset="1" stopColor={colors[1]} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#meal)" />
        </Svg>
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Copy small style={{ color: '#fff', fontWeight: '700' }}>
          {meal.mealType?.toUpperCase()}
        </Copy>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 3,
            paddingHorizontal: 9,
            borderRadius: 12,
            gap: 5,
            backgroundColor: '#00000038',
          }}
        >
          <Icon
            size={14}
            color={preview ? '#ffe2a3' : '#fff'}
            name={preview ? 'clock-outline' : mealDone(meal) ? 'check-circle-outline' : 'circle-outline'}
          />
          <Copy small style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
            {preview ? 'Awaiting review' : mealDone(meal) ? 'Logged' : 'Ready to log'}
          </Copy>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <View
          style={{
            width: 90,
            height: 90,
            borderRadius: 45,
            padding: 5,
            backgroundColor: theme.isDark ? '#12362c' : '#fff',
          }}
        >
          {url ? (
            <Image
              source={{ uri: url }}
              accessibilityLabel={meal.image?.altText ?? meal.mealName}
              style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.soft }}
            />
          ) : (
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.greenSoft,
              }}
            >
              <Icon name="silverware-fork-knife" size={30} />
            </View>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 145, gap: 5 }}>
          <Copy style={{ color: '#fff', fontFamily: fonts.display, fontSize: 21, lineHeight: 27, fontWeight: '700' }}>
            {meal.mealName}
          </Copy>
          {meal.ricePortion ? (
            <Copy small style={{ color: '#fff' }}>
              {meal.ricePortion}
            </Copy>
          ) : null}
          <Copy small style={{ color: '#fff', fontWeight: '600' }}>
            {Math.round(finite(meal.calories))} kcal · {Math.round(finite(meal.proteinG))}g P ·{' '}
            {Math.round(finite(meal.carbsG))}g C · {Math.round(finite(meal.fatG))}g F
          </Copy>
        </View>
      </View>
      {!preview ? (
        <View
          style={{
            alignSelf: 'flex-end',
            flexDirection: 'row',
            gap: 6,
            alignItems: 'center',
            paddingVertical: 7,
            paddingHorizontal: 14,
            borderRadius: 20,
            backgroundColor: '#fff',
          }}
        >
          <Copy small style={{ color: '#0d2820', fontFamily: fonts.display, fontWeight: '700' }}>
            View meal
          </Copy>
          <Icon name="chevron-right" size={17} color="#0d2820" />
        </View>
      ) : (
        <Copy small style={{ color: '#fff' }}>
          Preview only · Required review still applies.
        </Copy>
      )}
    </View>
  );
  return preview ? (
    contents
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${meal.mealName}`}
      onPress={() => router.push({ pathname: '/meal/[id]', params: { id: meal.id } })}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      {contents}
    </Pressable>
  );
}
