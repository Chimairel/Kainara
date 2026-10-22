import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, View } from 'react-native';
import { SessionProvider, useSession } from '../lib/session';
import { Busy, Button, Notice, Screen } from '../ui/components';
import { useTheme } from '../ui/theme';

function Navigation() {
  const { profile, loading, error, refresh } = useSession();
  const theme = useTheme();
  if (Platform.OS === 'web')
    return (
      <Screen>
        <Notice
          title="Open the native app"
          body="This client stores sessions in your device’s encrypted storage. Run it with Expo Go on Android or iOS; use the existing KAINARA website for browsers."
        />
      </Screen>
    );
  if (loading && !profile) return <Busy label="Checking your KAINARA account…" />;
  if (error)
    return (
      <Screen>
        <Notice title="Could not check your account" body={error} error />
        <Button label="Retry account check" onPress={refresh} />
      </Screen>
    );
  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        <View
          style={{ flex: 1 }}
          pointerEvents={loading ? 'none' : 'auto'}
          importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={loading}
        >
          <Stack
            key={profile?.id ?? 'signed-out'}
            screenOptions={{
              headerStyle: { backgroundColor: theme.background },
              headerTintColor: theme.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: theme.background },
              headerBackButtonDisplayMode: 'minimal',
            }}
          >
            <Stack.Protected guard={!profile}>
              <Stack.Screen name="login" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={Boolean(profile)}>
              <Stack.Screen name="(member)" options={{ headerShown: false }} />
            </Stack.Protected>
          </Stack>
        </View>
        {loading ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} accessibilityViewIsModal>
            <Busy label="Checking your KAINARA account…" />
          </View>
        ) : null}
      </View>
    </>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Navigation />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
