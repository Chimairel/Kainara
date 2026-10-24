import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSession } from '../../lib/session';
import { api } from '../../lib/client';
import { Button, Choice, Copy, Field, Notice, Panel, Screen, useAction } from '../../ui/components';
import { PortalHeader } from '../../ui/portal';
import { memberGate } from '../../lib/policies';

export default function Profile() {
  const { profile, refresh, signOut } = useSession();
  const action = useAction();
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState(params.section === 'settings' ? 'settings' : 'health');
  const [weight, setWeight] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  return (
    <Screen keyboard>
      <PortalHeader
        title={section === 'settings' ? 'Settings' : section === 'planning' ? 'Food & planning' : 'Health & goals'}
        description={
          section === 'settings'
            ? 'Manage your account and security.'
            : 'Your recorded measurements, goals and planning preferences.'
        }
      />
      <Choice
        label="Personalization"
        segmented
        value={section}
        onChange={setSection}
        options={[
          ['health', 'Health & goals'],
          ['planning', 'Food & planning'],
          ['settings', 'Settings'],
        ]}
      />
      <Copy style={{ fontWeight: '700' }}>{profile?.name}</Copy>
      <Copy small muted>
        {profile?.email}
      </Copy>
      {section !== 'settings' ? (
        <>
          <Button label="Nutrition guidance & report" secondary onPress={() => router.push('/report')} />
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
            <Copy>
              Activity: {profile?.userProfile?.activityLevel?.replaceAll('_', ' ').toLowerCase() ?? 'Not recorded'}
            </Copy>
            <Copy>Diet: {profile?.userProfile?.dietaryPreference?.toLowerCase() ?? 'Not recorded'}</Copy>
            <Copy>
              Rice preference:{' '}
              {profile?.userProfile?.ricePreference?.replaceAll('_', ' ').toLowerCase() ?? 'Not recorded'}
            </Copy>
            <Copy>Food culture: {profile?.userProfile?.foodCulture ?? 'Not recorded'}</Copy>
            <Copy>
              Shopping day:{' '}
              {profile?.userProfile?.shoppingDayOfWeek == null
                ? 'Not recorded'
                : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
                    profile.userProfile.shoppingDayOfWeek
                  ]}
            </Copy>
            <Copy small muted>
              Clinical corrections, detailed clarification and account linking remain available on the website.
            </Copy>
            <Button label="Open account help" secondary onPress={() => router.push('/account-help')} />
          </Panel>
          {section === 'health' ? (
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
          ) : null}
        </>
      ) : (
        <>
          <Button label="Account & privacy" secondary onPress={() => router.push('/account')} />
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
        </>
      )}
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
        Appearance follows your device by default. Use the header control to switch themes for this session.
      </Copy>
    </Screen>
  );
}
