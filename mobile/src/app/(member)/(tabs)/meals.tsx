import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useResource } from '../../../lib/use-resource';
import type { Meal, HistoryEntry } from '../../../lib/contracts';
import { dateLabel, manilaDate } from '../../../lib/policies';
import { Button, Choice, Copy, Divider, Field, Notice, Panel, Screen } from '../../../ui/components';
import { MealRow, Macros } from '../../../ui/meal-row';

export default function Meals() {
  const [tab, setTab] = useState('plan');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [cursors, setCursors] = useState<string[]>([]);
  const plan = useResource<Meal[]>(tab === 'plan' ? '/user/meals/current' : null);
  const history = useResource<HistoryEntry[]>(tab === 'history' ? '/user/meals/history' : null);
  const library = useResource<Meal[]>(
    tab === 'library'
      ? `/user/meals/compatible-library?limit=20&search=${encodeURIComponent(search)}${cursors.length ? `&cursor=${encodeURIComponent(cursors[cursors.length - 1])}` : ''}`
      : null
  );
  const active = tab === 'plan' ? plan : tab === 'library' ? library : history;
  const dates = Array.from(
    new Set(
      [...(plan.data ?? []), ...(plan.meta?.pendingReview?.meals ?? [])].map((meal) => manilaDate(meal.scheduledDate))
    )
  ).sort();
  return (
    <Screen refreshing={active.loading} onRefresh={() => void active.reload()}>
      <Copy title>Meals that fit your day.</Copy>
      <Choice
        label="View"
        value={tab}
        onChange={setTab}
        options={[
          ['plan', 'Your plan'],
          ['history', 'History'],
          ['library', 'Library'],
        ]}
      />
      {tab === 'library' ? (
        <>
          <Field
            label="Search recipes"
            value={query}
            onChangeText={setQuery}
            maxLength={120}
            returnKeyType="search"
            onSubmitEditing={() => {
              setSearch(query.trim());
              setCursors([]);
            }}
          />
          <Button
            label="Search library"
            secondary
            onPress={() => {
              setSearch(query.trim());
              setCursors([]);
            }}
          />
          <Copy small muted>
            Recipe reviews and individual meal approval have different scopes. A library listing does not grant approval
            for a new member or portion.
          </Copy>
        </>
      ) : null}
      {active.error ? (
        <Notice error title="Could not load meals" body={active.error} onRetry={() => void active.reload()} />
      ) : null}
      {active.loading ? (
        <Copy muted>Loading meals…</Copy>
      ) : tab === 'plan' ? (
        <>
          {plan.meta?.generationStatus ? (
            <Copy muted>
              Preparation: {plan.meta.generationStatus.replaceAll('_', ' ').toLowerCase()}
              {plan.meta.awaitingGenerationCount ? ` · ${plan.meta.awaitingGenerationCount} slots still preparing` : ''}
            </Copy>
          ) : null}
          {dates.map((date) => (
            <View key={date} style={{ gap: 10 }}>
              <Copy style={{ fontSize: 22, fontWeight: '700' }}>{dateLabel(date)}</Copy>
              {plan.data
                ?.filter((meal) => manilaDate(meal.scheduledDate) === date)
                .map((meal) => (
                  <View key={meal.id}>
                    <MealRow meal={meal} />
                    <Divider />
                  </View>
                ))}
              {plan.meta?.pendingReview?.meals
                ?.filter((meal) => manilaDate(meal.scheduledDate) === date)
                .map((meal, index) => (
                  <View key={`${date}-preview-${index}`}>
                    <MealRow meal={meal} preview />
                    <Divider />
                  </View>
                ))}
            </View>
          ))}
          {!dates.length && !plan.error ? (
            <Notice
              title="Your plan is not ready yet"
              body="Check your preparation status again shortly. Required profile or meal reviews still apply; this screen never grants approval."
              onRetry={() => void plan.reload()}
            />
          ) : null}
        </>
      ) : tab === 'library' ? (
        <>
          {library.data?.map((meal) => (
            <Panel key={meal.id}>
              <Copy style={{ fontSize: 20, fontWeight: '700' }}>{meal.mealName}</Copy>
              <Copy muted>{meal.description}</Copy>
              <Macros meal={meal} />
              {meal.verifier ? (
                <Copy small muted>
                  Recorded recipe reviewer: {meal.verifier.name}
                </Copy>
              ) : null}
            </Panel>
          ))}
          {!library.data?.length && !library.error ? (
            <Notice
              title="No matching recipes"
              body="Try a different search. The library respects the current server eligibility rules."
            />
          ) : null}
          {cursors.length ? (
            <Button
              label="Previous recipes"
              secondary
              disabled={library.loading}
              onPress={() => setCursors((current) => current.slice(0, -1))}
            />
          ) : null}
          {library.meta?.nextCursor ? (
            <Button
              label="Next recipes"
              secondary
              disabled={library.loading}
              onPress={() => setCursors((current) => [...current, library.meta!.nextCursor!])}
            />
          ) : null}
        </>
      ) : (
        <>
          {history.data?.map((log) => (
            <Panel key={log.id}>
              <Copy small muted>
                {dateLabel(log.loggedAt)} · {log.source === 'USER_LOGGED' ? 'Outside food' : 'Planned meal'}
              </Copy>
              <Copy style={{ fontSize: 20, fontWeight: '700' }}>{log.mealName}</Copy>
              <Macros meal={log} />
              {log.source === 'USER_LOGGED' ? (
                <Button
                  label="View food feedback"
                  secondary
                  onPress={() => router.push({ pathname: '/log-food', params: { logId: log.id } })}
                />
              ) : null}
            </Panel>
          ))}
          {!history.data?.length && !history.error ? (
            <Notice
              title="Your food history starts here"
              body="Meals you log will appear here, with their recorded nutrition and review feedback."
            />
          ) : null}
        </>
      )}
      <Button label="Log food or snack" onPress={() => router.push('/log-food')} />
    </Screen>
  );
}
