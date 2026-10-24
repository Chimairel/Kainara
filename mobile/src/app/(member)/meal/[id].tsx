import React from 'react';
import { Alert, Image, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useLocalSearchParams, router } from 'expo-router';
import { useResource } from '../../../lib/use-resource';
import { useSession } from '../../../lib/session';
import { api } from '../../../lib/client';
import type { Meal } from '../../../lib/contracts';
import { safeExternalUrl, mealDone, manilaDate, dateLabel } from '../../../lib/policies';
import { Button, Busy, Copy, Notice, Panel, Screen, openExternal, useAction } from '../../../ui/components';
import { Macros } from '../../../ui/meal-row';

export default function MealDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useResource<Meal>(id ? `/user/meals/${encodeURIComponent(id)}` : null);
  const action = useAction();
  const { refresh } = useSession();
  const meal = resource.data;
  if (resource.loading) return <Busy label="Opening your meal…" />;
  if (resource.error || !meal)
    return (
      <Screen>
        <Notice
          error
          title="Meal unavailable"
          body={resource.error ?? 'This meal could not be found.'}
          onRetry={() => void resource.reload()}
        />
      </Screen>
    );
  const image = meal.image?.url ? safeExternalUrl(meal.image.url) : null;
  const actionable = meal.status === 'APPROVED' && manilaDate(meal.scheduledDate) <= manilaDate();
  const save = (status: string) =>
    action.run(async () => {
      await api.request(`/user/meals/${encodeURIComponent(meal.id)}/status`, 'PATCH', { status });
      await refresh();
      await resource.reload();
    });
  return (
    <Screen>
      <View
        style={{
          minHeight: 280,
          borderRadius: 28,
          overflow: 'hidden',
          backgroundColor: '#0d2820',
          justifyContent: 'flex-end',
        }}
      >
        {image ? (
          <Image
            source={{ uri: image }}
            accessibilityLabel={meal.image?.altText ?? meal.mealName}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
          />
        ) : null}
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
          <Svg width="100%" height="100%" accessible={false}>
            <Defs>
              <LinearGradient id="hero" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000" stopOpacity={0.85} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#hero)" />
          </Svg>
        </View>
        <View style={{ padding: 20, gap: 8 }}>
          <Copy small style={{ color: '#fff', fontWeight: '600' }}>
            {dateLabel(meal.scheduledDate)} · {meal.mealType.toUpperCase()}
          </Copy>
          <Copy title style={{ color: '#fff' }}>
            {meal.mealName}
          </Copy>
        </View>
      </View>
      {actionable ? (
        <>
          <Button
            label={mealDone(meal) ? 'Undo eaten status' : 'Mark as eaten'}
            busy={action.busy}
            onPress={() => {
              Alert.alert(mealDone(meal) ? 'Undo this food log?' : 'Record this meal as eaten?', meal.mealName, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', onPress: () => void save(mealDone(meal) ? 'PENDING' : 'DONE') },
              ]);
            }}
          />
          <Button
            label="Skip this meal"
            secondary
            disabled={action.busy}
            onPress={() => {
              Alert.alert('Skip this meal?', 'You can change its status later if the meal remains available.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Skip meal', onPress: () => void save('SKIPPED') },
              ]);
            }}
          />
        </>
      ) : (
        <Notice
          title={meal.status === 'APPROVED' ? 'Scheduled for a future day' : 'Awaiting meal clearance'}
          body="Meal actions become available only when the server’s date, profile and review requirements are met."
        />
      )}
      {meal.image?.attribution?.creator ? (
        <Copy small muted>
          Image: {meal.image.attribution.creator}
        </Copy>
      ) : null}
      <Panel>
        <Copy style={{ fontWeight: '700' }}>MACRO DISTRIBUTION</Copy>
        <Macros meal={meal} />
      </Panel>
      {meal.ricePortion ? <Copy muted>{meal.ricePortion}</Copy> : null}
      <Copy>{meal.description}</Copy>
      <Panel>
        <Copy style={{ fontWeight: '700' }}>Review record</Copy>
        <Copy muted>
          {meal.verifier
            ? `Reviewed by ${meal.verifier.name} · ${meal.verifier.reviewScope === 'RECIPE' ? 'recipe review' : 'recorded review'}`
            : 'No nutritionist review is recorded for this meal.'}
        </Copy>
        {meal.explanation?.bullets.map((bullet, index) => (
          <Copy small key={index}>
            {bullet}
          </Copy>
        ))}
        {meal.explanation?.limitation ? (
          <Copy small muted>
            {meal.explanation.limitation}
          </Copy>
        ) : null}
      </Panel>
      {meal.ingredients?.length ? (
        <Panel>
          <Copy style={{ fontWeight: '700' }}>Ingredients</Copy>
          {meal.ingredients.map((ingredient, index) => (
            <Copy key={ingredient.id ?? index}>{ingredient.ingredientName}</Copy>
          ))}
        </Panel>
      ) : null}
      {action.error ? (
        <Notice
          error
          title="Meal was not updated"
          body={action.error}
          onRetry={() => {
            void refresh().then(() => resource.reload());
          }}
        />
      ) : null}
      <Button
        secondary
        label="Need cooking help?"
        onPress={() =>
          openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${meal.mealName} recipe`)}`)
        }
      />
      <Button secondary label="Back to meals" onPress={() => router.replace('/meals')} />
    </Screen>
  );
}
