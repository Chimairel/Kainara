import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Copy, Field, Notice, Screen, useAction } from '../ui/components';
import { useSession } from '../lib/session';
import { api, configurationError } from '../lib/client';
import { useTheme } from '../ui/theme';

export default function Login() {
  const session = useSession();
  const action = useAction();
  const theme = useTheme();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [info, setInfo] = useState('');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <Screen keyboard>
        <View style={{ paddingTop: 24, gap: 24 }}>
          <Image
            source={require('../../assets/kainara-icon.png')}
            accessibilityLabel="KAINARA"
            style={{ width: 52, height: 52, borderRadius: 20 }}
          />
          <View style={{ gap: 10 }}>
            <Copy title>{register ? 'Create your account' : 'Enter your workspace'}</Copy>
            <Copy muted>Familiar food. Personal guidance. A little help from KAINARA.</Copy>
          </View>
          <View style={{ gap: 18 }}>
            {register ? (
              <Field
                label="Full name"
                value={name}
                onChangeText={setName}
                autoComplete="name"
                textContentType="name"
                maxLength={161}
              />
            ) : null}
            <Field
              label="Email address"
              value={email}
              onChangeText={setEmail}
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              keyboardType="email-address"
              maxLength={254}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={register ? 'new-password' : 'current-password'}
              textContentType={register ? 'newPassword' : 'password'}
              maxLength={128}
            />
            {register ? (
              <Copy small muted>
                Use at least 8 characters, including an uppercase letter and a number.
              </Copy>
            ) : null}
            {action.error ? <Notice error title="Please try again" body={action.error} /> : null}
            {action.error ? (
              <Button
                label="Retry saved session"
                secondary
                disabled={action.busy}
                onPress={() => action.run(session.refresh)}
              />
            ) : null}
            {info ? <Copy muted>{info}</Copy> : null}
            <Button
              label={register ? 'Create account' : 'Sign in'}
              busy={action.busy}
              disabled={!email.trim() || !password || (register && !name.trim()) || Boolean(configurationError)}
              onPress={() =>
                action.run(() => session.signIn(email.trim(), password, register ? name.trim() : undefined))
              }
            />
            <Button
              secondary
              label={register ? 'I already have an account' : 'Create an account'}
              disabled={action.busy}
              onPress={() => {
                setRegister(!register);
                action.setError(null);
                setInfo('');
                setPassword('');
              }}
            />
            {!register ? (
              <Button
                secondary
                label="Send a password reset email"
                disabled={action.busy || !email.trim()}
                onPress={() =>
                  action.run(async () => {
                    await api.publicRequest('/auth/forgot-password', 'POST', { email: email.trim() }, false);
                    setInfo('If that account exists, password reset instructions will arrive by email.');
                  })
                }
              />
            ) : null}
          </View>
          <Copy small muted>
            Your health information stays private. Meal estimates and automated checks do not replace individual
            professional advice.
          </Copy>
        </View>
      </Screen>
    </SafeAreaView>
  );
}
