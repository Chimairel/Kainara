import React, { useState } from 'react';
import { Button, Copy, Field, Notice, Screen, useAction } from '../../ui/components';
import { api } from '../../lib/client';
import { useSession } from '../../lib/session';
export default function Verify() {
  const { profile, refresh, signOut } = useSession();
  const [otp, setOtp] = useState('');
  const [info, setInfo] = useState('');
  const action = useAction();
  return (
    <Screen keyboard>
      <Copy title>Check your inbox.</Copy>
      <Copy muted>
        Enter the six-digit code sent to {profile?.email}. Keep this screen open while checking your email.
      </Copy>
      <Field
        label="Verification code"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
      />
      {action.error ? <Notice title="Could not verify" body={action.error} error /> : null}
      {info ? <Copy muted>{info}</Copy> : null}
      <Button
        label="Verify email"
        busy={action.busy}
        disabled={!/^\d{6}$/.test(otp)}
        onPress={() =>
          action.run(async () => {
            await api.request('/auth/verify-email', 'POST', { otp });
            await refresh();
          })
        }
      />
      <Button
        label="Send another code"
        secondary
        disabled={action.busy}
        onPress={() =>
          action.run(async () => {
            await api.request('/auth/resend-verification', 'POST', {});
            setInfo('A new code was requested. Check your inbox and spam folder.');
          })
        }
      />
      <Button label="Sign out" secondary onPress={signOut} />
    </Screen>
  );
}
