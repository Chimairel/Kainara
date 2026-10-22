import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../../lib/session';
import { api } from '../../lib/client';
import { Button, Copy, Field, Notice, Panel, Screen, useAction } from '../../ui/components';
import { memberGate } from '../../lib/policies';

export default function Profile() {
  const { profile, refresh, signOut } = useSession();
  const action = useAction();
  const [weight, setWeight] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  return (
    <Screen keyboard>
      <Copy title>{profile?.name}</Copy>
      <Copy muted>{profile?.email}</Copy>
      <Button label="Nutrition guidance & report" secondary onPress={() => router.push('/report')} />
      <Button label="Account & privacy" secondary onPress={() => router.push('/account')} />
      <Panel>
        <Copy style={{ fontWeight: '700' }}>Recorded planning profile</Copy>
        <Copy>
          Age: {profile?.userProfile?.age ?? 'Not recorded'} · Sex:{' '}
          {profile?.userProfile?.biologicalSex?.toLowerCase() ?? 'Not recorded'}
        </Copy>
        <Copy>
          Height: {profile?.userProfile?.heightCm ?? 'Not recorded'} cm · Weight:{' '}
          {profile?.userProfile?.weightKg ?? 'Not recorded'} kg
        </Copy>
        <Copy>Goal: {profile?.userProfile?.goal?.replaceAll('_', ' ').toLowerCase() ?? 'Not recorded'}</Copy>
        <Copy>Conditions: {profile?.healthConditions.join(', ') || 'Not recorded'}</Copy>
        <Copy>Restrictions: {profile?.allergies.join(', ') || 'Not recorded'}</Copy>
        <Copy small muted>
          Clinical corrections, detailed clarification and account linking remain available on the website.
        </Copy>
        <Button label="Open account help" secondary onPress={() => router.push('/account-help')} />
      </Panel>
      <Panel>
        <Copy style={{ fontWeight: '700' }}>Update weight</Copy>
        <Field
          label="Current weight (kg)"
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          maxLength={6}
        />
        <Button
          label="Save weight & return Home"
          busy={action.busy}
          disabled={Number(weight) < 30 || Number(weight) > 300 || !Number.isFinite(Number(weight))}
          onPress={() =>
            action.run(async () => {
              await api.request('/user/progress/weight', 'POST', { weightKg: Number(weight) });
              await refresh();
              router.replace('/');
            })
          }
        />
      </Panel>
      <Panel>
        <Copy style={{ fontWeight: '700' }}>Change password</Copy>
        <Field
          label="Current password"
          value={oldPassword}
          onChangeText={setOldPassword}
          secureTextEntry
          autoComplete="current-password"
        />
        <Field
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoComplete="new-password"
          maxLength={128}
        />
        <Button
          label="Change password"
          disabled={!oldPassword || newPassword.length < 8}
          busy={action.busy}
          onPress={() =>
            action.run(async () => {
              await api.request('/user/profile/settings', 'PUT', { currentPassword: oldPassword, newPassword });
              await api.clearRejectedSession();
              setOldPassword('');
              setNewPassword('');
            })
          }
        />
      </Panel>
      {profile && memberGate(profile) === 'ready' ? (
        <>
          <Button label="Talk to Nara" secondary onPress={() => router.push('/nara')} />
          <Button label="Your notifications" secondary onPress={() => router.push('/notifications')} />
        </>
      ) : null}
      {action.error ? <Notice error title="Could not update your account" body={action.error} /> : null}
      <Button
        label="Sign out of this device"
        secondary
        busy={action.busy}
        onPress={() => {
          Alert.alert(
            'Sign out?',
            'This revokes this device’s refresh session and clears its encrypted sign-in data.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', onPress: () => void action.run(signOut) },
            ]
          );
        }}
      />
      <Copy small muted>
        App appearance follows your device’s light or dark setting.
      </Copy>
    </Screen>
  );
}
