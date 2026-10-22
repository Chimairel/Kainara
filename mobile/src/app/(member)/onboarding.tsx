import React, { useState } from 'react';
import { View, Switch } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../../lib/session';
import { api } from '../../lib/client';
import { Button, Choice, Copy, Field, Notice, Screen, useAction, openExternal } from '../../ui/components';
import { webUrl } from '../../lib/web-links';

const goals = [
  ['MAINTAIN', 'Maintain weight'],
  ['LOSE_WEIGHT', 'Lose weight'],
  ['GAIN_WEIGHT', 'Gain weight'],
  ['BUILD_MUSCLE', 'Build muscle'],
] as const;
const activities = [
  ['SEDENTARY', 'Mostly seated'],
  ['LIGHTLY_ACTIVE', 'Lightly active'],
  ['ACTIVE', 'Active'],
  ['VERY_ACTIVE', 'Very active'],
] as const;
const steps = [
  'Your measurements',
  'Your food preferences',
  'Health conditions',
  'Food restrictions',
  'Shopping day',
  'Your consent',
] as const;
const paths = ['stats', 'preferences', 'conditions', 'allergies', 'shopping-day', 'tos'];
function Multiple({
  label,
  selected,
  setSelected,
  options,
}: {
  label: string;
  selected: string[];
  setSelected(value: string[]): void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <View style={{ gap: 12 }}>
      <Copy style={{ fontWeight: '700' }}>{label}</Copy>
      {options.map(([key, text]) => (
        <View
          key={key}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            minHeight: 48,
          }}
        >
          <Copy>{text}</Copy>
          <Switch
            accessibilityLabel={text}
            value={selected.includes(key)}
            onValueChange={(enabled) =>
              setSelected(
                enabled
                  ? key === 'NONE'
                    ? ['NONE']
                    : [...selected.filter((value) => value !== 'NONE'), key]
                  : selected.filter((value) => value !== key)
              )
            }
          />
        </View>
      ))}
    </View>
  );
}
export default function Onboarding() {
  const { profile, refresh, signOut } = useSession();
  const saved = profile?.userProfile;
  const status = profile?.onboardingStatus;
  const action = useAction();
  const [step, setStep] = useState(Math.max(0, paths.indexOf(status?.nextPath.split('/').pop() ?? 'stats')));
  const [age, setAge] = useState(String(saved?.age ?? ''));
  const [height, setHeight] = useState(String(saved?.heightCm ?? ''));
  const [weight, setWeight] = useState(String(saved?.weightKg ?? ''));
  const [target, setTarget] = useState(String(saved?.targetWeightKg ?? ''));
  const [sex, setSex] = useState(saved?.biologicalSex ?? '');
  const [goal, setGoal] = useState(saved?.goal ?? '');
  const [activity, setActivity] = useState(saved?.activityLevel ?? '');
  const [diet, setDiet] = useState(saved?.dietaryPreference ?? '');
  const [rice, setRice] = useState(saved?.ricePreference ?? '');
  const [culture, setCulture] = useState(saved?.foodCulture ?? '');
  const [conditions, setConditions] = useState<string[]>(profile?.healthConditions ?? []);
  const [allergies, setAllergies] = useState<string[]>(profile?.allergies ?? []);
  const [otherConditions, setOtherConditions] = useState('');
  const [otherAllergies, setOtherAllergies] = useState('');
  const [shopping, setShopping] = useState(
    saved?.shoppingDayOfWeek === undefined ? '' : String(saved.shoppingDayOfWeek)
  );
  const [breakfast, setBreakfast] = useState('08:00');
  const [lunch, setLunch] = useState('13:00');
  const [dinner, setDinner] = useState('19:00');
  const [medical, setMedical] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [health, setHealth] = useState(false);
  const save = () =>
    action.run(async () => {
      if (step === 0) {
        if (![age, height, weight].every((value) => value.trim()) || !sex || !goal || !activity)
          throw new Error('Complete your measurements, sex, goal and activity level.');
        await api.request('/user/onboarding/profile', 'POST', {
          age: Number(age),
          heightCm: Number(height),
          weightKg: Number(weight),
          targetWeightKg: goal === 'MAINTAIN' ? Number(weight) : Number(target),
          biologicalSex: sex,
          goal,
          activityLevel: activity,
        });
      } else if (step === 1) {
        if (!diet || !rice || !culture.trim())
          throw new Error('Choose your food preferences and describe the cuisine you prefer.');
        await api.request('/user/onboarding/profile', 'POST', {
          dietaryPreference: diet,
          ricePreference: rice,
          foodCulture: culture.trim(),
        });
        await api.request('/user/meal-reminders', 'PUT', {
          breakfastTime: breakfast,
          lunchTime: lunch,
          dinnerTime: dinner,
          timeZone: 'Asia/Manila',
          remindersEnabled: false,
          prepareEnabled: false,
          logEnabled: false,
        });
      } else if (step === 2) {
        if (!conditions.length && !otherConditions.trim())
          throw new Error('Choose your conditions, enter details, or explicitly choose none.');
        await api.request('/user/onboarding/safety', 'POST', {
          entries: [
            ...conditions.map((value) => ({ domain: 'CONDITION', value, provenance: 'PREDEFINED' })),
            ...(otherConditions.trim()
              ? [{ domain: 'CONDITION', value: otherConditions.trim(), provenance: 'CUSTOM' }]
              : []),
          ],
          editableDomains: ['CONDITION'],
          confirmed: true,
        });
      } else if (step === 3) {
        if (!allergies.length && !otherAllergies.trim())
          throw new Error('Choose your restrictions, enter details, or explicitly choose none.');
        await api.request('/user/onboarding/safety', 'POST', {
          entries: [
            ...allergies.map((value) => ({ domain: 'ALLERGY', value, provenance: 'PREDEFINED' })),
            ...(otherAllergies.trim()
              ? [{ domain: 'ALLERGY', value: otherAllergies.trim(), provenance: 'CUSTOM' }]
              : []),
          ],
          editableDomains: ['ALLERGY'],
          confirmed: true,
        });
      } else if (step === 4) {
        if (!shopping) throw new Error('Choose your shopping day.');
        await api.request('/user/onboarding/shopping-day', 'POST', { shoppingDayOfWeek: Number(shopping) });
      } else {
        if (!medical || !privacy || !health || !status?.currentTermsVersion || !status.currentPrivacyVersion)
          throw new Error('Read and accept each consent item before continuing.');
        await api.request('/user/onboarding/tos', 'POST', {
          termsVersion: status.currentTermsVersion,
          privacyVersion: status.currentPrivacyVersion,
          medicalDisclaimerAccepted: true,
          privacyPolicyAccepted: true,
          healthDataProcessingAccepted: true,
        });
        await api.request('/user/onboarding/complete', 'POST', {});
        await refresh();
        return;
      }
      setStep((current) => current + 1);
    });
  return (
    <Screen keyboard>
      <Copy muted>
        Step {step + 1} of {steps.length}
      </Copy>
      <Copy title>{steps[step]}</Copy>
      {step === 0 ? (
        <>
          <Copy muted>
            These details support the recorded planning estimate. Enter measurements you know; do not guess a diagnosis.
          </Copy>
          <Field label="Age (18–100 years)" value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={3} />
          <Choice
            label="Biological sex used in the energy equation"
            value={sex}
            onChange={setSex}
            options={[
              ['MALE', 'Male'],
              ['FEMALE', 'Female'],
            ]}
          />
          <Field label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
          <Field label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
          <Choice label="Your goal" value={goal} onChange={setGoal} options={goals} />
          {goal !== 'MAINTAIN' ? (
            <Field label="Target weight (kg)" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
          ) : null}
          <Choice label="Activity level" value={activity} onChange={setActivity} options={activities} />
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Choice
            label="Dietary preference"
            value={diet}
            onChange={setDiet}
            options={[
              ['OMNIVORE', 'Omnivore'],
              ['VEGETARIAN', 'Vegetarian'],
              ['VEGAN', 'Vegan'],
              ['PESCATARIAN', 'Pescatarian'],
            ]}
          />
          <Choice
            label="Rice preference"
            value={rice}
            onChange={setRice}
            options={[
              ['WITH_RICE', 'With rice'],
              ['FLEXIBLE', 'Flexible'],
              ['NO_RICE', 'No rice'],
            ]}
          />
          <Field
            label="Preferred cuisine"
            value={culture}
            onChangeText={setCulture}
            placeholder="For example, Filipino"
            maxLength={80}
          />
          <Copy style={{ fontWeight: '700' }}>Usual meal times (Philippine time)</Copy>
          <Field label="Breakfast, 05:00–10:00" value={breakfast} onChangeText={setBreakfast} maxLength={5} />
          <Field label="Lunch, 11:00–15:00" value={lunch} onChangeText={setLunch} maxLength={5} />
          <Field label="Dinner, 17:00–23:00" value={dinner} onChangeText={setDinner} maxLength={5} />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Multiple
            label="Reported conditions"
            selected={conditions}
            setSelected={setConditions}
            options={[
              ['DIABETES', 'Diabetes'],
              ['HYPERTENSION', 'Hypertension'],
              ['KIDNEY_DISEASE', 'Kidney disease'],
              ['HEART_CONDITION', 'Heart condition'],
              ['PREGNANT', 'Pregnant'],
              ['NONE', 'None of these'],
            ]}
          />
          <Field
            label="Other conditions, if any"
            value={otherConditions}
            onChangeText={(value) => {
              setOtherConditions(value);
              if (value.trim()) setConditions((current) => current.filter((item) => item !== 'NONE'));
            }}
            multiline
            maxLength={500}
          />
          <Copy small muted>
            Unrecognized details may require clarification. Required individual or meal reviews still apply.
          </Copy>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Multiple
            label="Reported food allergies"
            selected={allergies}
            setSelected={setAllergies}
            options={[
              ['SHELLFISH', 'Shellfish'],
              ['NUTS', 'Nuts'],
              ['DAIRY', 'Dairy'],
              ['GLUTEN', 'Gluten'],
              ['EGGS', 'Eggs'],
              ['NONE', 'None of these'],
            ]}
          />
          <Field
            label="Other restrictions, if any"
            value={otherAllergies}
            onChangeText={(value) => {
              setOtherAllergies(value);
              if (value.trim()) setAllergies((current) => current.filter((item) => item !== 'NONE'));
            }}
            multiline
            maxLength={500}
          />
        </>
      ) : null}
      {step === 4 ? (
        <Choice
          label="When do you usually shop?"
          value={shopping}
          onChange={setShopping}
          options={[
            ['0', 'Sunday'],
            ['1', 'Monday'],
            ['2', 'Tuesday'],
            ['3', 'Wednesday'],
            ['4', 'Thursday'],
            ['5', 'Friday'],
            ['6', 'Saturday'],
          ]}
        />
      ) : null}
      {step === 5 ? (
        <>
          <Copy>
            Review the current Terms and Privacy Policy before accepting. KAINARA uses recorded health data for
            planning, screening and review workflows. Estimates are not a diagnosis, prescription or guarantee of
            suitability.
          </Copy>
          <Button label="Read Terms of Service" secondary onPress={() => openExternal(webUrl('/terms'))} />
          <Button label="Read Privacy Policy" secondary onPress={() => openExternal(webUrl('/privacy'))} />
          {(
            [
              ['I understand the medical limitations and accept the Terms of Service.', medical, setMedical],
              ['I have read and accept the Privacy Policy.', privacy, setPrivacy],
              ['I consent to processing my health information for the stated purposes.', health, setHealth],
            ] as const
          ).map(([label, value, setter]) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 60 }}>
              <View style={{ flex: 1 }}>
                <Copy>{label}</Copy>
              </View>
              <Switch accessibilityLabel={label} value={value} onValueChange={setter} />
            </View>
          ))}
        </>
      ) : null}
      {action.error ? <Notice error title="Setup needs your attention" body={action.error} /> : null}
      <Button label={step === 5 ? 'Finish setup' : 'Save and continue'} busy={action.busy} onPress={save} />
      {step > 0 ? (
        <Button
          label="Back"
          secondary
          disabled={action.busy}
          onPress={() => {
            action.setError(null);
            setStep((current) => current - 1);
          }}
        />
      ) : null}
      <Button label="Account help or clinical clarification" secondary onPress={() => router.push('/account-help')} />
      <Button label="Sign out" secondary onPress={signOut} />
    </Screen>
  );
}
