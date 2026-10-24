import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import type { Meal } from '../lib/contracts';
import { finite, mealDone, safeExternalUrl } from '../lib/policies';
import { Copy, Icon } from './components';
import { fonts, useTheme } from './theme';

/** Native counterpart of the PWA PlanMealCardSurface; preview/recipe scopes stay separate. */
export function MealTile({
  meal,
  preview = false,
  recipe = false,
}: {
  meal: Meal;
  preview?: boolean;
  recipe?: boolean;
}) {
  const theme = useTheme();
  const url = meal.image?.url ? safeExternalUrl(meal.image.url) : null;
  const type = meal.mealType?.toUpperCase();
  const color = type === 'BREAKFAST' ? '#d45320' : type === 'DINNER' ? '#4338ca' : '#08705b';
  const contents = (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 8,
        gap: 10,
        boxShadow: '0px 3px 10px rgba(5,18,14,0.06)',
      }}
    >
      <View style={{ height: 144, borderRadius: 20, backgroundColor: color, overflow: 'hidden' }}>
        {url ? (
          <Image
            source={{ uri: url }}
            accessibilityLabel={meal.image?.altText ?? meal.mealName}
            style={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: 100,
              top: -20,
              left: -28,
              borderColor: '#ffffff99',
              borderWidth: 1,
            }}
          />
        ) : (
          <View style={{ alignItems: 'center', justifyContent: 'center', height: '100%', width: 150 }}>
            <Icon name="silverware-fork-knife" size={42} color="#fff" />
          </View>
        )}
        <View style={{ position: 'absolute', right: 10, top: 10, alignItems: 'flex-end', gap: 6 }}>
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 14,
              paddingHorizontal: 10,
              paddingVertical: 4,
              flexDirection: 'row',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <Icon name="silverware-fork-knife" size={14} color="#08705b" />
            <Copy small style={{ color: '#0d2820', fontWeight: '700', fontSize: 10 }}>
              {type || 'RECIPE'}
            </Copy>
          </View>
          {!recipe ? (
            <View style={{ backgroundColor: '#00000070', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Copy small style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                {preview ? 'Awaiting review' : mealDone(meal) ? 'Logged' : 'Unlogged'}
              </Copy>
            </View>
          ) : null}
          {meal.verifier ? (
            <View style={{ backgroundColor: '#083e33', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Copy small style={{ color: '#fff', fontSize: 10 }}>
                {recipe ? 'Recipe reviewed' : 'Verified'}
              </Copy>
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ padding: 4, gap: 4 }}>
        <Copy style={{ fontFamily: fonts.display, fontWeight: '700', fontSize: 17, lineHeight: 23 }}>
          {meal.mealName}
        </Copy>
        {meal.ricePortion ? (
          <Copy small style={{ color: theme.green }}>
            + {meal.ricePortion}
          </Copy>
        ) : null}
        <Copy small muted>
          {meal.description || (preview ? 'Pending nutritionist review.' : 'Open this meal for its recipe details.')}
        </Copy>
        {meal.verifier ? (
          <Copy small style={{ color: theme.green }}>
            Reviewed by {meal.verifier.name}
            {recipe ? ' · Recipe review' : ''}
          </Copy>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {[
            [`${Math.round(finite(meal.calories))} kcal`, theme.text],
            [`${Math.round(finite(meal.proteinG))}g P`, theme.green],
            [`${Math.round(finite(meal.carbsG))}g C`, theme.carbs],
            [`${Math.round(finite(meal.fatG))}g F`, theme.isDark ? '#f09e6c' : '#b84318'],
          ].map(([label, tint]) => (
            <View
              key={label}
              style={{
                backgroundColor: tint + '10',
                borderWidth: 1,
                borderColor: tint + '30',
                borderRadius: 18,
                paddingHorizontal: 9,
                paddingVertical: 4,
              }}
            >
              <Copy small style={{ color: tint, fontSize: 11, fontWeight: '600' }}>
                {label}
              </Copy>
            </View>
          ))}
        </View>
        {preview ? (
          <Copy small muted>
            Preview only. This meal cannot be logged or swapped.
          </Copy>
        ) : null}
      </View>
    </View>
  );
  return preview || recipe ? (
    contents
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${meal.mealName}`}
      onPress={() => router.push({ pathname: '/meal/[id]', params: { id: meal.id } })}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      {contents}
    </Pressable>
  );
}
