import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { SvgXml } from 'react-native-svg';
import { useSession } from '../../../lib/session';
import { useResource } from '../../../lib/use-resource';
import { dateLabel, finite, manilaDate, memberGate } from '../../../lib/policies';
import type { HistoryEntry, Meal } from '../../../lib/contracts';
import { api } from '../../../lib/client';
import { Button, Copy, Divider, Notice, Panel, Screen, useAction } from '../../../ui/components';
import { MealRow } from '../../../ui/meal-row';
import { useTheme } from '../../../ui/theme';
import { sleepingNara } from '../../../../assets/sleeping-nara';

export default function Home() {
  const { profile, refresh } = useSession();
  const ready = profile && memberGate(profile) === 'ready';
  const theme = useTheme();
  const action = useAction();
  const plan = useResource<Meal[]>(ready ? '/user/meals/current' : null);
  const history = useResource<HistoryEntry[]>(
    ready ? `/user/meals/history?startDate=${manilaDate()}T00%3A00%3A00%2B08%3A00` : null
  );
  const water = useResource<{ totalMl: number }>(ready ? '/user/water/today' : null);
  const meals = plan.data?.filter((meal) => manilaDate(meal.scheduledDate) === manilaDate()) ?? [];
  const consumed = (history.data ?? [])
    .filter((log) => (log as HistoryEntry & { status?: string }).status === 'DONE')
    .reduce((sum, log) => sum + finite(log.calories), 0);
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
      <View style={{ gap: 6 }}>
        <Copy title>Mabuhay, {profile?.name.split(' ')[0]}.</Copy>
        <Copy muted>{dateLabel(manilaDate())} · Your meals, one day at a time.</Copy>
      </View>
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
          <Panel style={{ backgroundColor: theme.greenSoft }}>
            <Copy style={{ fontWeight: '600' }}>Your daily intake</Copy>
            <Copy title>
              {history.loading
                ? 'Checking…'
                : history.error
                  ? 'Unavailable'
                  : `${Math.round(consumed).toLocaleString()} kcal`}
            </Copy>
            <Copy muted>
              Planning target: {profile?.userProfile?.dailyCalorieTarget?.toLocaleString() ?? 'Not recorded'} kcal
            </Copy>
            {history.data?.some((log) => log.nutritionCompleteness && log.nutritionCompleteness !== 'COMPLETE') ? (
              <Copy small muted>Some food logs have incomplete nutrition. This total may exclude unknown values.</Copy>
            ) : null}
            <Button label="Log food or snack" icon="plus" onPress={() => router.push('/log-food')} />
          </Panel>
          {history.error ? (
            <Notice error title="Intake could not load" body={history.error} onRetry={() => void history.reload()} />
          ) : null}
          <Panel>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Copy style={{ fontWeight: '700' }}>Water today</Copy>
              <Copy>
                {water.loading ? 'Checking…' : water.error ? 'Unavailable' : `${water.data?.totalMl ?? 0} mL`}
              </Copy>
            </View>
            <Copy small muted>
              Track what you drink. Individual fluid needs may differ from general references.
            </Copy>
            <Button
              label="Add 250 mL"
              secondary
              busy={action.busy}
              disabled={water.loading || Boolean(water.error)}
              onPress={() =>
                action.run(async () => {
                  await api.request('/user/water', 'POST', { amountMl: 250 });
                  await water.reload();
                })
              }
            />
          </Panel>
          {water.error ? (
            <Notice error title="Water could not load" body={water.error} onRetry={() => void water.reload()} />
          ) : null}
          <View>
            <Copy title style={{ fontSize: 24 }}>
              On your menu
            </Copy>
            {plan.error ? (
              <Notice error title="Plan unavailable" body={plan.error} onRetry={() => void plan.reload()} />
            ) : plan.loading ? (
              <Copy muted>Loading your meals…</Copy>
            ) : meals.length ? (
              meals.map((meal) => (
                <View key={meal.id}>
                  <MealRow meal={meal} />
                  <Divider />
                </View>
              ))
            ) : (
              <Notice
                title="No cleared meals for today"
                body="Your plan may be preparing or waiting for review. Open Meals for dates, preparation status and pending previews."
              />
            )}
          </View>
          {(plan.meta?.pendingReview?.meals?.length ?? 0) > 0 ? (
            <Copy muted>{plan.meta?.pendingReview?.meals?.length} meals are awaiting nutritionist review.</Copy>
          ) : null}
          <Button label="Ask Nara" icon="chat-outline" secondary onPress={() => router.push('/nara')} />
        </>
      )}
      {action.error ? <Notice title="Could not complete the action" body={action.error} error /> : null}
    </Screen>
  );
}
