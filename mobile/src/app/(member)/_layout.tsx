import React from 'react';
import { Stack } from 'expo-router';
import { useSession } from '../../lib/session';
import { memberGate } from '../../lib/policies';
import { fonts, useTheme } from '../../ui/theme';
import { ChatProvider } from '../../lib/chat-state';

export default function MemberLayout() {
  const { profile } = useSession();
  const theme = useTheme();
  const gate = profile ? memberGate(profile) : 'verify';
  return (
    <ChatProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerTitleStyle: { fontFamily: fonts.display },
          contentStyle: { backgroundColor: theme.background },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Protected guard={gate === 'verify'}>
          <Stack.Screen name="verify" options={{ title: 'Verify your email' }} />
        </Stack.Protected>
        <Stack.Protected guard={gate === 'onboarding'}>
          <Stack.Screen name="onboarding" options={{ title: 'Your food & planning profile' }} />
        </Stack.Protected>
        <Stack.Protected guard={gate === 'ready' || gate === 'report'}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="report" options={{ title: 'Nutrition guidance' }} />
          <Stack.Screen name="profile" options={{ title: 'Your profile' }} />
        </Stack.Protected>
        <Stack.Protected guard={gate === 'ready'}>
          <Stack.Screen name="meal/[id]" options={{ title: 'Meal details' }} />
          <Stack.Screen name="nara" options={{ title: 'Nara' }} />
          <Stack.Screen name="log-food" options={{ title: 'Log food or snack', presentation: 'modal' }} />
          <Stack.Screen name="notifications" options={{ title: 'Your notifications' }} />
        </Stack.Protected>
        <Stack.Screen name="account" options={{ title: 'Account & privacy' }} />
        <Stack.Screen name="account-help" options={{ title: 'Account help' }} />
      </Stack>
    </ChatProvider>
  );
}
