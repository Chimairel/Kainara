import React from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme } from '../../../ui/theme';
import { useSession } from '../../../lib/session';
import { memberGate } from '../../../lib/policies';
import { MemberHeaderActions, MemberTabBar } from '../../../ui/member-nav';
import { NaraShortcut } from '../../../ui/nara-portrait';

export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const ready = profile && memberGate(profile) === 'ready';
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <MemberTabBar {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerTitleStyle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600' },
          headerShadowVisible: false,
          headerRight: () => <MemberHeaderActions />,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
        <Tabs.Protected guard={Boolean(ready)}>
          <Tabs.Screen name="meals" options={{ title: 'Meals' }} />
          <Tabs.Screen name="groceries" options={{ title: 'Groceries' }} />
          <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
        </Tabs.Protected>
      </Tabs>
      {ready ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', right: 16, bottom: insets.bottom + 112 }}>
          <NaraShortcut />
        </View>
      ) : null}
    </View>
  );
}
