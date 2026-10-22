import React from 'react';
import { View, Alert } from 'react-native';
import { router } from 'expo-router';
import { useResource } from '../../lib/use-resource';
import type { Report } from '../../lib/contracts';
import { useSession } from '../../lib/session';
import { api } from '../../lib/client';
import { Button, Copy, Divider, Notice, Panel, Screen, openExternal, useAction } from '../../ui/components';
import { shareReportPdf } from '../../lib/report-pdf';

export default function ReportScreen() {
  const resource = useResource<Report>('/user/nutrition-report');
  const { refresh } = useSession();
  const action = useAction();
  const report = resource.data;
  const calc = report?.calorieCalculation;
  const targets = report?.planningTargets;
  return (
    <Screen refreshing={resource.loading} onRefresh={() => void resource.reload()}>
      <Copy title>Your nutrition guidance</Copy>
      {resource.error ? (
        <Notice error title="Report unavailable" body={resource.error} onRetry={() => void resource.reload()} />
      ) : null}
      {report ? (
        <>
          <Copy muted>
            Version {report.version}
            {report.acknowledgedAt && !report.isStale ? ' · Acknowledged' : ' · Needs acknowledgment'}
          </Copy>
          <Panel>
            <Copy style={{ fontSize: 21, fontWeight: '700' }}>Your recorded profile</Copy>
            {report.profileSummary?.length ? (
              report.profileSummary.map((item, index) => (
                <View key={index} style={{ gap: 3 }}>
                  <Copy small muted>
                    {item.label}
                  </Copy>
                  <Copy>{item.value || 'Not recorded'}</Copy>
                </View>
              ))
            ) : (
              <Copy muted>Detailed profile fields were not recorded in this report version.</Copy>
            )}
          </Panel>
          <View style={{ gap: 12 }}>
            <Copy style={{ fontSize: 23, fontWeight: '700' }}>What these numbers mean</Copy>
            <Copy>{report.generalSummary}</Copy>
            <Copy muted>
              These are planning estimates. Acknowledgment does not replace any required review or establish medical
              suitability.
            </Copy>
          </View>
          {targets ? (
            <Panel>
              <Copy style={{ fontSize: 23, fontWeight: '700' }}>Daily planning estimate</Copy>
              <Copy title>{targets.calories.toLocaleString()} kcal</Copy>
              <Copy muted>{targets.explanation}</Copy>
              <Divider />
              <Copy>
                Protein: {targets.proteinG} g · Fat: {targets.fatG} g · Carbohydrate: {targets.carbsG} g
              </Copy>
            </Panel>
          ) : (
            <Copy muted>Planning targets: Not recorded.</Copy>
          )}
          {calc ? (
            <View style={{ gap: 12 }}>
              <Copy style={{ fontSize: 23, fontWeight: '700' }}>How the daily kcal target is calculated</Copy>
              <Copy>
                BMR = 10 × {calc.inputs.weightKg} kg + 6.25 × {calc.inputs.heightCm} cm − 5 × {calc.inputs.age} years{' '}
                {calc.sexTerm >= 0 ? '+' : '−'} {Math.abs(calc.sexTerm)} = {calc.rawBmr.toLocaleString()} kcal/day.
              </Copy>
              <Copy>
                Daily expenditure = {calc.rawBmr.toLocaleString()} × {calc.activityMultiplier} ={' '}
                {calc.rawTdee.toLocaleString()} kcal/day.
              </Copy>
              <Copy>
                Goal adjustment: {calc.goalAdjustment} kcal/day. Daily target after the saved policy:{' '}
                {calc.dailyCalorieTarget.toLocaleString()} kcal/day.
              </Copy>
              <Button secondary label={calc.sourceTitle} onPress={() => openExternal(calc.sourceUrl)} />
            </View>
          ) : (
            <Copy muted>Calorie calculation: Not recorded.</Copy>
          )}
          {targets ? (
            <View style={{ gap: 12 }}>
              <Copy style={{ fontSize: 23, fontWeight: '700' }}>Protein, fat and carbohydrate</Copy>
              <Copy>
                Protein: {targets.proteinG} g × 4 kcal/g = {Math.round(targets.proteinG * 4)} kcal.
              </Copy>
              <Copy>
                Fat: {targets.fatG} g × 9 kcal/g = {Math.round(targets.fatG * 9)} kcal.
              </Copy>
              <Copy>
                Carbohydrate: {targets.carbsG} g × 4 kcal/g = {Math.round(targets.carbsG * 4)} kcal.
              </Copy>
              <Copy small muted>
                Displayed grams may be rounded; energy totals can differ slightly.
              </Copy>
            </View>
          ) : null}
          {report.referenceItems?.map((item, index) => (
            <View key={index} style={{ gap: 8 }}>
              <Copy style={{ fontWeight: '700' }}>{item.heading}</Copy>
              <Copy>{item.value}</Copy>
              <Copy muted>{item.explanation}</Copy>
            </View>
          ))}
          {report.foodGuidance
            ? (['avoid', 'limit', 'choose', 'discuss'] as const).map((key) => (
                <View key={key} style={{ gap: 16 }}>
                  <Copy style={{ fontSize: 23, fontWeight: '700' }}>
                    {
                      {
                        avoid: 'Avoid',
                        limit: 'Limit',
                        choose: 'Choose more often',
                        discuss: 'Discuss with your nutritionist',
                      }[key]
                    }
                  </Copy>
                  {report.foodGuidance?.[key].length ? (
                    report.foodGuidance[key].map((item, index) => (
                      <View key={index} style={{ gap: 6 }}>
                        <Copy style={{ fontWeight: '600' }}>{item.name}</Copy>
                        <Copy>{item.reason}</Copy>
                        <Copy muted>{item.tip}</Copy>
                        <Copy small muted>
                          Source: {item.sourceCode}
                        </Copy>
                      </View>
                    ))
                  ) : (
                    <Copy muted>No specific items are recorded in this section.</Copy>
                  )}
                </View>
              ))
            : null}
          {report.foodGuidance?.sources.map((source) => (
            <Button
              key={source.code}
              secondary
              label={`${source.code} · ${source.title}`}
              onPress={() => openExternal(source.url)}
            />
          ))}
          {report.isStale ? (
            <>
              <Notice
                title="Your profile has changed"
                body="Prepare an updated report before acknowledgment. Previous report records remain in your history."
              />
              <Button
                label="Prepare updated report"
                busy={action.busy}
                onPress={() =>
                  action.run(async () => {
                    await api.request('/user/nutrition-report/generate', 'POST', {});
                    await resource.reload();
                    await refresh();
                  })
                }
              />
            </>
          ) : !report.acknowledgedAt ? (
            <Button
              label="Acknowledge this report"
              busy={action.busy}
              onPress={() => {
                Alert.alert(
                  'Acknowledge your nutrition guidance?',
                  'This records that you have read this version. Any required meal or profile review still applies.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Acknowledge',
                      onPress: () =>
                        void action.run(async () => {
                          await api.request('/user/nutrition-report/acknowledge', 'POST', { version: report.version });
                          await refresh();
                          router.replace('/');
                        }),
                    },
                  ]
                );
              }}
            />
          ) : null}
          <Button
            label="Share or save PDF"
            secondary
            busy={action.busy}
            onPress={() => action.run(() => shareReportPdf(report.version))}
          />
        </>
      ) : !resource.loading && !resource.error ? (
        <Notice
          title="No report is available yet"
          body="Prepare your first report from your saved profile."
          onRetry={() => {
            void action.run(async () => {
              await api.request('/user/nutrition-report/generate', 'POST', {});
              await resource.reload();
            });
          }}
        />
      ) : null}
      {action.error ? <Notice error title="Could not update the report" body={action.error} /> : null}
    </Screen>
  );
}
