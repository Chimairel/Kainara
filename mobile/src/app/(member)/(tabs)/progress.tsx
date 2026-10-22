import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useResource } from '../../../lib/use-resource';
import { useSession } from '../../../lib/session';
import { api } from '../../../lib/client';
import type { Progress } from '../../../lib/contracts';
import { dateLabel } from '../../../lib/policies';
import { Button, Copy, Divider, Field, Notice, Panel, Screen, useAction } from '../../../ui/components';
import { useTheme } from '../../../ui/theme';

export default function ProgressScreen() {
  const resource = useResource<Progress>('/user/progress/history');
  const { refresh } = useSession();
  const action = useAction();
  const [weight, setWeight] = useState('');
  const theme = useTheme();
  const days = resource.data?.waterHistory?.days ?? [];
  const maxWater = Math.max(1, ...days.map((day) => day.totalMl));
  return (
    <Screen keyboard refreshing={resource.loading} onRefresh={() => void resource.reload()}>
      <Copy title>Small steps, recorded.</Copy>
      <Copy muted>Look at patterns over time. Your weight is one part of the picture.</Copy>
      <Panel>
        <Copy style={{ fontWeight: '700' }}>Log your weight</Copy>
        <Field
          label="Weight in kilograms"
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          maxLength={6}
        />
        <Copy small muted>
          Changes can update your planning target. You’ll return Home to acknowledge your current nutrition report.
        </Copy>
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
      </Panel>
      {action.error ? <Notice error title="Weight was not updated" body={action.error} /> : null}
      {resource.error ? (
        <Notice error title="History unavailable" body={resource.error} onRetry={() => void resource.reload()} />
      ) : null}
      {resource.loading ? (
        <Copy muted>Loading your progress…</Copy>
      ) : (
        <>
          <View style={{ gap: 12 }}>
            <Copy style={{ fontSize: 23, fontWeight: '700' }}>Water over the last week</Copy>
            {days.map((day) => (
              <View
                key={day.date}
                accessible
                accessibilityLabel={`${dateLabel(day.date)}, ${day.totalMl} millilitres`}
                style={{ gap: 6 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Copy small muted>
                    {dateLabel(day.date)}
                  </Copy>
                  <Copy small>{day.totalMl} mL</Copy>
                </View>
                <View style={{ height: 10, borderRadius: 5, backgroundColor: theme.soft, overflow: 'hidden' }}>
                  <View
                    style={{ width: `${(day.totalMl / maxWater) * 100}%`, height: 10, backgroundColor: theme.green }}
                  />
                </View>
              </View>
            ))}
            {!days.length ? <Copy muted>No water history is available yet.</Copy> : null}
          </View>
          <View style={{ gap: 14 }}>
            <Copy style={{ fontSize: 23, fontWeight: '700' }}>Weight history</Copy>
            {resource.data?.weightLogs
              .slice()
              .reverse()
              .map((row) => (
                <View key={row.id} style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Copy muted>{dateLabel(row.loggedAt)}</Copy>
                    <Copy style={{ fontWeight: '600' }}>{row.weightKg} kg</Copy>
                  </View>
                  <Divider />
                </View>
              ))}
            {!resource.data?.weightLogs.length ? <Copy muted>Your weight entries will appear here.</Copy> : null}
          </View>
        </>
      )}
    </Screen>
  );
}
