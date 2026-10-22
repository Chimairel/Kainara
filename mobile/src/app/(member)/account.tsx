import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useSession } from '../../lib/session';
import { api } from '../../lib/client';
import { Button, Copy, Field, Notice, Panel, Screen, useAction, openExternal } from '../../ui/components';
import { webUrl } from '../../lib/web-links';
export default function Account() {
  const { profile } = useSession();
  const action = useAction();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  return (
    <Screen keyboard>
      <Copy title>Account & privacy</Copy>
      <Copy>{profile?.email}</Copy>
      <Button label="Read Privacy Policy" secondary onPress={() => openExternal(webUrl('/privacy'))} />
      <Button label="Open data export on the website" secondary onPress={() => openExternal(webUrl('/profile'))} />
      <Panel>
        <Copy style={{ fontSize: 22, fontWeight: '700' }}>Delete your account</Copy>
        <Copy>
          This permanently removes your account and associated personal records through KAINARA’s existing deletion
          workflow. This cannot be undone. Google-only accounts must use the website’s Google reauthentication.
        </Copy>
        <Field
          label="Current password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />
        <Field
          label="Type DELETE MY KAINARA ACCOUNT"
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          maxLength={25}
        />
        <Button
          label="Permanently delete my account"
          busy={action.busy}
          disabled={!password || confirmation !== 'DELETE MY KAINARA ACCOUNT'}
          onPress={() =>
            Alert.alert(
              'Permanently delete your account?',
              'Your personal records will be removed. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete account',
                  style: 'destructive',
                  onPress: () =>
                    void action.run(async () => {
                      await api.request('/user/account', 'DELETE', { password, confirmation });
                      await api.clearRejectedSession();
                    }),
                },
              ]
            )
          }
        />
      </Panel>
      {action.error ? <Notice error title="Account was not deleted" body={action.error} /> : null}
    </Screen>
  );
}
