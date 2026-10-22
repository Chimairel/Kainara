import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import type { Meal } from '../lib/contracts';
import { Copy, Icon } from './components';
import { useTheme } from './theme';
import { finite, mealDone, safeExternalUrl } from '../lib/policies';

export function Macros({ meal }: { meal: { calories: number; proteinG: number; carbsG: number; fatG: number; nutritionCompleteness?: string; provisionalCalories?: number } }) {
  return (
    <View style={{ gap: 5 }}>
      <Copy style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>{Math.round(finite(meal.calories))} kcal</Copy>
      <Copy small muted>
        {Math.round(finite(meal.proteinG))} g protein · {Math.round(finite(meal.carbsG))} g carbs ·{' '}
        {Math.round(finite(meal.fatG))} g fat
      </Copy>
      {meal.nutritionCompleteness && meal.nutritionCompleteness !== 'COMPLETE' ? (
        <Copy small muted>Nutrition is incomplete. Shown totals may exclude unknown values.</Copy>
      ) : null}
      {finite(meal.provisionalCalories) > 0 ? (
        <Copy small muted>{Math.round(finite(meal.provisionalCalories))} kcal remains provisional.</Copy>
      ) : null}
    </View>
  );
}
export function MealRow({ meal, preview = false }: { meal: Meal; preview?: boolean }) {
  const theme = useTheme();
  const url = meal.image?.url ? safeExternalUrl(meal.image.url) : null;
  const contents = (
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', paddingVertical: 18 }}>
      {url ? (
        <Image
          source={{ uri: url }}
          accessibilityLabel={meal.image?.altText ?? meal.mealName}
          style={{ width: 88, height: 100, borderRadius: 18, backgroundColor: theme.soft }}
        />
      ) : (
        <View
          style={{
            width: 88,
            height: 100,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.greenSoft,
          }}
        >
          <Icon name="silverware-fork-knife" size={30} />
        </View>
      )}
      <View style={{ flex: 1, gap: 6 }}>
        <Copy small muted>
          {meal.mealType?.toLowerCase()} · {preview ? 'Awaiting review' : mealDone(meal) ? 'Logged' : 'Ready to log'}
        </Copy>
        <Copy style={{ fontSize: 19, lineHeight: 25, fontWeight: '700' }}>{meal.mealName}</Copy>
        {meal.ricePortion ? (
          <Copy small muted>
            {meal.ricePortion}
          </Copy>
        ) : null}
        <Copy small>
          {Math.round(finite(meal.calories))} kcal · {Math.round(finite(meal.proteinG))} g protein
        </Copy>
      </View>
      {!preview ? <Icon name="chevron-right" color={theme.muted} /> : null}
    </View>
  );
  return preview ? (
    contents
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${meal.mealName}`}
      onPress={() => router.push({ pathname: '/meal/[id]', params: { id: meal.id } })}
    >
      {contents}
    </Pressable>
  );
}
