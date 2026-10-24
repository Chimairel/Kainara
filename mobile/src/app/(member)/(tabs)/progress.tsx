import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useResource } from '../../../lib/use-resource';
import { useSession } from '../../../lib/session';
import { api } from '../../../lib/client';
import type { Progress } from '../../../lib/contracts';
import { dateLabel } from '../../../lib/policies';
import { Button, Choice, Copy, Divider, Field, Icon, Notice, Panel, Screen, useAction } from '../../../ui/components';
import { MetricCard, PortalHeader } from '../../../ui/portal';
import { WaterChart, WeightChart } from '../../../ui/progress-charts';
import { useTheme } from '../../../ui/theme';

export default function ProgressScreen() {
  const resource = useResource<Progress>('/user/progress/history');
  const { profile, refresh } = useSession();
  const action = useAction();
  const [weight, setWeight] = useState('');
  const [form, setForm] = useState(false);
  const [tab, setTab] = useState('overview');
  const theme = useTheme();
  const current = profile?.userProfile?.weightKg;
  const target = profile?.userProfile?.targetWeightKg;
  const calorieTarget = profile?.userProfile?.dailyCalorieTarget;
  return (
    <Screen keyboard refreshing={resource.loading} onRefresh={() => void resource.reload()}>
      <PortalHeader
        title="Progress"
        description="Your weight, daily intake and progress over time."
        actions={
          <>
            <Button
              label="Log today's weight"
              icon="plus-circle-outline"
              onPress={() => {
                setTab('overview');
                setForm(!form);
              }}
            />
            <Button label="Update health" icon="chart-line" secondary onPress={() => router.push('/profile')} />
          </>
        }
      />
      <Choice
        label="Progress view"
        segmented
        value={tab}
        onChange={setTab}
        options={[
          ['overview', 'Overview'],
          ['adherence', 'Daily Adherence'],
        ]}
      />
      {form && tab === 'overview' ? (
        <Panel>
          <Copy style={{ fontWeight: '700' }}>Log Today’s Weight</Copy>
          <Copy small muted>
            Changes can update your planning target. You’ll return Home to acknowledge your current nutrition report.
          </Copy>
          <Field
            label="Weight in kilograms"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            maxLength={6}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
            <Button label="Cancel" secondary onPress={() => setForm(false)} />
            <Button
              label="Save weight"
              busy={action.busy}
              disabled={!Number.isFinite(Number(weight)) || Number(weight) < 30 || Number(weight) > 300}
              onPress={() =>
                action.run(async () => {
                  await api.request('/user/progress/weight', 'POST', { weightKg: Number(weight) });
                  await refresh();
                  setWeight('');
                  router.replace('/');
                })
              }
            />
          </View>
        </Panel>
      ) : null}
      {action.error ? <Notice error title="Weight was not updated" body={action.error} /> : null}
      {resource.error ? (
        <Notice error title="History unavailable" body={resource.error} onRetry={() => void resource.reload()} />
      ) : null}
      {tab === 'overview' ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <MetricCard
              label="Current weight"
              value={current ? `${current} kg` : 'Not recorded'}
              color={theme.green}
              icon={<Icon name="chart-line" color={theme.green} size={20} />}
            />
            <MetricCard
              label="Target weight"
              value={target ? `${target} kg` : 'Not recorded'}
              color={theme.primary}
              icon={<Icon name="chart-line" color={theme.primary} size={20} />}
            />
            <MetricCard
              label="Distance to goal"
              value={current && target ? `${Math.abs(target - current).toFixed(1)} kg` : 'Not recorded'}
              color={theme.carbs}
              icon={<Icon name="chart-line" color={theme.carbs} size={20} />}
            />
            <MetricCard
              label="Daily calorie target"
              value={calorieTarget ? `${calorieTarget.toLocaleString()} kcal` : 'Not recorded'}
              color={theme.primary}
              icon={<Icon name="plus-circle-outline" color={theme.primary} size={20} />}
            />
          </View>
          {resource.loading ? (
            <Copy muted>Loading your progress…</Copy>
          ) : (
            <>
              <WeightChart rows={resource.data?.weightLogs ?? []} target={target} />
              <WaterChart days={resource.data?.waterHistory?.days ?? []} />
            </>
          )}
        </>
      ) : (
        <Panel>
          <Copy style={{ fontWeight: '700' }}>Daily Adherence</Copy>
          <Copy muted>Recorded intake for each day. Missing nutrition is not counted as meeting a target.</Copy>
          {resource.data?.dailyNutritionLogs.map((row) => (
            <View key={row.id} style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Copy>{dateLabel(row.logDate)}</Copy>
                <Copy style={{ fontWeight: '600' }}>
                  {row.totalCalories ?? row.consumedCalories ?? 'Not recorded'}
                  {row.totalCalories != null || row.consumedCalories != null ? ' kcal' : ''}
                </Copy>
              </View>
              <Divider />
            </View>
          ))}
          {!resource.data?.dailyNutritionLogs.length ? <Copy muted>No daily intake records yet.</Copy> : null}
        </Panel>
      )}
    </Screen>
  );
}
