import React, { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { api } from '../../lib/client';
import { useResource } from '../../lib/use-resource';
import type { HistoryEntry } from '../../lib/contracts';
import { Button, Choice, Copy, Field, Notice, Panel, Screen, useAction } from '../../ui/components';
import { Macros } from '../../ui/meal-row';

type OutsideItem = {
  id: string;
  name: string;
  source: string;
  review?: {
    status: string;
    requestedByUserAt?: string | null;
    messages: { id: string; sender: string; content: string }[];
  } | null;
};
type Log = HistoryEntry & { outsideItems: OutsideItem[] };
type Preview = {
  warningRequired: true;
  confirmationId: string;
  warnings: string[];
  expiresAt: string;
  estimate: { calories: number; proteinG: number; carbsG: number; fatG: number };
  summary: { unresolvedItemCount: number; provisionalItemCount: number; provisionalCalories: number };
  items: { name: string; source: string; servingDescription?: string; warnings: string[] }[];
};
type Input = {
  mealType: string;
  requestKey: string;
  useAiEstimate: boolean;
  items: {
    name: string;
    portionGrams?: number;
    reportedNutrition?: { calories: number; proteinG: number; carbsG: number; fatG: number };
  }[];
};
type Saved = { warningRequired: false; log: Log };
export default function LogFood() {
  const { logId } = useLocalSearchParams<{ logId?: string }>();
  const history = useResource<Log[]>(logId ? '/user/meals/history' : null);
  const action = useAction();
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [type, setType] = useState('LUNCH');
  const [basis, setBasis] = useState('reference');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saved, setSaved] = useState<Log | null>(null);
  const key = useRef(Crypto.randomUUID());
  const frozen = useRef<Input | null>(null);
  function changed() {
    setPreview(null);
    frozen.current = null;
    key.current = Crypto.randomUUID();
  }
  const log = saved ?? history.data?.find((item) => item.id === logId);
  const requestReview = (log: Log, item: OutsideItem) =>
    action.run(async () => {
      await api.request(
        `/user/meals/logs/${encodeURIComponent(log.id)}/items/${encodeURIComponent(item.id)}/request-review`,
        'POST',
        {}
      );
      const refreshed = await api.request<Log[]>('/user/meals/history');
      setSaved(refreshed.data.find((row) => row.id === log.id) ?? log);
    });
  const previewFood = () =>
    action.run(async () => {
      if (!name.trim()) throw new Error('Enter the food name.');
      const portionGrams = grams.trim() ? Number(grams) : undefined;
      if (portionGrams !== undefined && (!Number.isFinite(portionGrams) || portionGrams <= 0 || portionGrams > 5000))
        throw new Error('Enter a measured portion between 0 and 5,000 g.');
      if (
        basis === 'manual' &&
        [calories, protein, carbs, fat].some(
          (value) => !value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0
        )
      )
        throw new Error('Enter all four nonnegative nutrition values from the label or menu.');
      const input = frozen.current ?? {
        mealType: type,
        requestKey: key.current,
        useAiEstimate: basis === 'ai',
        items: [
          {
            name: name.trim(),
            ...(portionGrams === undefined ? {} : { portionGrams }),
            ...(basis === 'manual'
              ? {
                  reportedNutrition: {
                    calories: Number(calories),
                    proteinG: Number(protein),
                    carbsG: Number(carbs),
                    fatG: Number(fat),
                  },
                }
              : {}),
          },
        ],
      };
      frozen.current = input;
      const response = await api.request<Preview | Saved>('/user/meals/log-outside', 'POST', input);
      if (!response.data.warningRequired) setSaved(response.data.log);
      else setPreview(response.data);
    });
  const commit = () =>
    action.run(async () => {
      if (!preview || !frozen.current || Date.parse(preview.expiresAt) <= Date.now())
        throw new Error('This preview expired. Edit the food and preview it again.');
      const response = await api.request<Saved>('/user/meals/log-outside', 'POST', {
        ...frozen.current,
        confirmationId: preview.confirmationId,
        warningAcknowledged: true,
        requestRndReview: false,
      });
      if (response.data.warningRequired !== false || !response.data.log?.id)
        throw new Error('Could not confirm that the food was saved. Check History before retrying.');
      setSaved(response.data.log);
      setPreview(null);
      const first = response.data.log.outsideItems?.[0];
      if (first)
        Alert.alert(
          'Food logged',
          'Would you like to request nutritionist feedback? You can also do this later from History.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Request feedback', onPress: () => void requestReview(response.data.log, first) },
          ]
        );
    });
  return (
    <Screen keyboard refreshing={history.loading} onRefresh={logId ? () => void history.reload() : undefined}>
      {logId && history.error ? (
        <Notice error title="Food history unavailable" body={history.error} onRetry={() => void history.reload()} />
      ) : null}
      {log ? (
        <>
          <Copy title>{log.mealName}</Copy>
          <Copy muted>Recorded outside food</Copy>
          <Macros meal={log} />
          {log.outsideItems?.map((item) => (
            <Panel key={item.id}>
              <Copy style={{ fontWeight: '700' }}>{item.name}</Copy>
              {item.review?.requestedByUserAt ? (
                <>
                  <Copy small muted>
                    Review: {item.review.status.replaceAll('_', ' ').toLowerCase()}
                  </Copy>
                  {item.review.messages
                    .filter((entry) => entry.sender === 'NUTRITIONIST')
                    .map((entry) => (
                      <Copy key={entry.id}>{entry.content}</Copy>
                    ))}
                </>
              ) : (
                <>
                  <Copy muted>No requested nutritionist feedback is recorded.</Copy>
                  <Button
                    label="Request RND feedback"
                    secondary
                    busy={action.busy}
                    onPress={() => requestReview(log, item)}
                  />
                </>
              )}
            </Panel>
          ))}
          <Button label="Back to meals" onPress={() => router.replace('/meals')} />
        </>
      ) : logId ? (
        <Copy muted>{history.loading ? 'Loading food record…' : 'This food record is unavailable.'}</Copy>
      ) : preview ? (
        <>
          <Copy title>Review your food log</Copy>
          <Macros meal={preview.estimate} />
          <Copy muted>Check the nutrition basis and warnings before saving. Saving does not request RND feedback.</Copy>
          {preview.summary?.unresolvedItemCount ? (
            <Notice
              title="Partial nutrition total"
              body={`${preview.summary.unresolvedItemCount} unresolved items are excluded from the total.`}
            />
          ) : null}
          {preview.items.map((item, index) => (
            <Panel key={index}>
              <Copy style={{ fontWeight: '700' }}>{item.name}</Copy>
              <Copy small muted>
                {item.source.replaceAll('_', ' ').toLowerCase()}
              </Copy>
              <Copy>{item.servingDescription}</Copy>
              {item.source === 'GEMINI_ESTIMATED' ? (
                <Copy muted>Gemini estimate, not a cited lookup. No web search or source citation was provided.</Copy>
              ) : null}
              {item.warnings.map((warning, i) => (
                <Copy key={i}>{warning}</Copy>
              ))}
            </Panel>
          ))}
          {preview.warnings.map((warning, index) => (
            <Copy key={index}>{warning}</Copy>
          ))}
          <Copy muted>
            A nutrition estimate does not establish whether a food is suitable for your conditions or allergies.
          </Copy>
          <Button label="Save food" busy={action.busy} onPress={commit} />
          <Button secondary label="Edit food" disabled={action.busy} onPress={changed} />
        </>
      ) : (
        <>
          <Copy title>What did you eat?</Copy>
          <Copy muted>
            Start with a reference lookup or enter nutrition-label values. AI estimates require your explicit choice and
            use the separate outside-food allowance.
          </Copy>
          <Field
            label="Food or dish name"
            value={name}
            onChangeText={(value) => {
              changed();
              setName(value);
            }}
            maxLength={180}
          />
          <Field
            label="Measured portion (grams, optional)"
            value={grams}
            onChangeText={(value) => {
              changed();
              setGrams(value);
            }}
            keyboardType="decimal-pad"
            maxLength={7}
          />
          <Choice
            label="Meal"
            value={type}
            onChange={(value) => {
              changed();
              setType(value);
            }}
            options={[
              ['BREAKFAST', 'Breakfast'],
              ['LUNCH', 'Lunch'],
              ['DINNER', 'Dinner'],
              ['SNACK', 'Snack'],
            ]}
          />
          <Choice
            label="Nutrition basis"
            value={basis}
            onChange={(value) => {
              changed();
              setBasis(value);
            }}
            options={[
              ['reference', 'Reference lookup'],
              ['manual', 'Label or menu'],
              ['ai', 'AI estimate'],
            ]}
          />
          {basis === 'manual' ? (
            <>
              <Field
                label="Calories (kcal)"
                value={calories}
                onChangeText={(value) => {
                  changed();
                  setCalories(value);
                }}
                keyboardType="decimal-pad"
              />
              <Field
                label="Protein (g)"
                value={protein}
                onChangeText={(value) => {
                  changed();
                  setProtein(value);
                }}
                keyboardType="decimal-pad"
              />
              <Field
                label="Carbohydrate (g)"
                value={carbs}
                onChangeText={(value) => {
                  changed();
                  setCarbs(value);
                }}
                keyboardType="decimal-pad"
              />
              <Field
                label="Fat (g)"
                value={fat}
                onChangeText={(value) => {
                  changed();
                  setFat(value);
                }}
                keyboardType="decimal-pad"
              />
            </>
          ) : null}
          <Button
            label={basis === 'ai' ? 'Request AI estimate & preview' : 'Preview food log'}
            busy={action.busy}
            disabled={!name.trim()}
            onPress={previewFood}
          />
        </>
      )}
      {action.error ? <Notice error title="Food logging needs your attention" body={action.error} /> : null}
    </Screen>
  );
}
