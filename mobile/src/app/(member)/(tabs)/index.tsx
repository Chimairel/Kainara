import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { SvgXml } from 'react-native-svg';
import { useSession } from '../../../lib/session';
import { useResource } from '../../../lib/use-resource';
import { dateLabel, manilaDate, mealDone, memberGate } from '../../../lib/policies';
import { dailyIntake, dashboardDates } from '../../../lib/dashboard';
import type { HistoryEntry, Meal } from '../../../lib/contracts';
import { api } from '../../../lib/client';
import { Button, Copy, Notice, Panel, Screen, useAction } from '../../../ui/components';
import { MealRow } from '../../../ui/meal-row';
import { DateStrip } from '../../../ui/date-strip';
import { DailyIntake } from '../../../ui/daily-intake';
import { PortalHeader } from '../../../ui/portal';
import { sleepingNara } from '../../../../assets/sleeping-nara';

export default function Home() {
  const { profile, refresh } = useSession();
  const ready = profile && memberGate(profile) === 'ready';
  const action = useAction();
  const [chosenDate, setChosenDate] = useState(manilaDate());
  const plan = useResource<Meal[]>(ready ? '/user/meals/current' : null);
  const dates = dashboardDates(
    [...(plan.data ?? []), ...(plan.meta?.pendingReview?.meals ?? [])],
    plan.meta?.cycle?.endDate
  );
  const selected = dates.includes(chosenDate) ? chosenDate : manilaDate();
  const history = useResource<HistoryEntry[]>(
    ready ? `/user/meals/history?startDate=${selected}T00%3A00%3A00%2B08%3A00` : null
  );
  const water = useResource<{ totalMl: number }>(ready ? '/user/water/today' : null);
  const meals = plan.data?.filter((meal) => manilaDate(meal.scheduledDate) === selected) ?? [];
  const pending = plan.meta?.pendingReview?.meals?.filter((meal) => manilaDate(meal.scheduledDate) === selected) ?? [];
  const intake = dailyIntake(history.data ?? [], selected, plan.meta, profile?.userProfile?.dailyCalorieTarget);
  return (
    <Screen
      refreshing={plan.loading}
      onRefresh={() => {
        void action.run(async () => {
          await refresh();
          if (ready) await Promise.all([plan.reload(), history.reload(), water.reload()]);
        });
      }}
    >
      <PortalHeader
        title={`Mabuhay, ${profile?.name.split(' ')[0]}.`}
        description="Your meals, daily intake, and next steps — all in one place."
        actions={
          ready ? (
            <>
              <Button label="Log food or snack" icon="plus-circle-outline" onPress={() => router.push('/log-food')} />
              <Button
                label="Weekly plan"
                icon="calendar-month-outline"
                secondary
                onPress={() => router.push('/meals')}
              />
            </>
          ) : undefined
        }
      />
      {!ready ? (
        <Panel>
          <SvgXml xml={sleepingNara} width="100%" height={150} accessibilityLabel="Sleeping Nara" />
          <Copy title>Your guidance is ready for a look.</Copy>
          <Copy muted>
            Acknowledge your current nutrition report before meal planning continues. Profile changes need a fresh
            acknowledgment.
          </Copy>
          <Button label="Read my nutrition report" onPress={() => router.push('/report')} />
        </Panel>
      ) : (
        <>
          {dates.length ? <DateStrip dates={dates} selected={selected} onSelect={setChosenDate} /> : null}
          <DailyIntake
            intake={intake}
            unavailable={Boolean(history.error)}
            loading={history.loading}
            waterMl={water.data?.totalMl ?? 0}
            waterUnavailable={water.loading || Boolean(water.error)}
            waterBusy={action.busy}
            showWater={selected === manilaDate()}
            dayLabel={selected === manilaDate() ? 'Today' : dateLabel(selected)}
            onWater={() => {
              void action.run(async () => {
                await api.request('/user/water', 'POST', { amountMl: 250 });
                await water.reload();
              });
            }}
          />
          {history.error ? (
            <Notice error title="Intake could not load" body={history.error} onRetry={() => void history.reload()} />
          ) : null}
          {water.error ? (
            <Notice error title="Water could not load" body={water.error} onRetry={() => void water.reload()} />
          ) : null}
          <View style={{ gap: 18 }}>
            <Copy title style={{ fontSize: 24 }}>
              On your menu
            </Copy>
            {plan.error ? (
              <Notice error title="Plan unavailable" body={plan.error} onRetry={() => void plan.reload()} />
            ) : plan.loading ? (
              <Copy muted>Loading your meals…</Copy>
            ) : meals.length || pending.length ? (
              <>
                {meals.map((meal) => (
                  <MealRow
                    key={meal.id}
                    meal={meal}
                    busy={action.busy}
                    onLog={
                      meal.status === 'APPROVED' && !mealDone(meal) && manilaDate(meal.scheduledDate) <= manilaDate()
                        ? () =>
                            Alert.alert('Record this meal as eaten?', meal.mealName, [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Confirm',
                                onPress: () =>
                                  void action.run(async () => {
                                    await api.request(`/user/meals/${encodeURIComponent(meal.id)}/status`, 'PATCH', {
                                      status: 'DONE',
                                    });
                                    await Promise.all([plan.reload(), history.reload()]);
                                  }),
                              },
                            ])
                        : undefined
                    }
                  />
                ))}
                {pending.length ? <Copy muted>Awaiting RND review · Previews cannot be logged or swapped.</Copy> : null}
                {pending.map((meal, index) => (
                  <MealRow key={`pending-${index}`} meal={meal} preview />
                ))}
              </>
            ) : (
              <Notice
                title="No cleared meals for this day"
                body="Your plan may be preparing or waiting for review. Open Meals for dates, preparation status and pending previews."
              />
            )}
          </View>
        </>
      )}
      {action.error ? <Notice title="Could not complete the action" body={action.error} error /> : null}
    </Screen>
  );
}
