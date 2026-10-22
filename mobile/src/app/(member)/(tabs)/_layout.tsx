import React from 'react';
import { Tabs, router } from 'expo-router';
import { Pressable } from 'react-native';
import { Icon } from '../../../ui/components';
import { useTheme } from '../../../ui/theme';
import { useSession } from '../../../lib/session';
import { memberGate } from '../../../lib/policies';

export default function TabLayout() {
  const theme = useTheme();
  const { profile } = useSession();
  const ready = profile && memberGate(profile) === 'ready';
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.green,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        tabBarLabelStyle: { fontSize: 12 },
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
            style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}
            onPress={() => router.push('/profile')}
          >
            <Icon name="account-circle-outline" />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Icon name="home-outline" color={color} /> }}
      />
      <Tabs.Protected guard={Boolean(ready)}>
        <Tabs.Screen
          name="meals"
          options={{ title: 'Meals', tabBarIcon: ({ color }) => <Icon name="silverware-fork-knife" color={color} /> }}
        />
        <Tabs.Screen
          name="groceries"
          options={{ title: 'Groceries', tabBarIcon: ({ color }) => <Icon name="basket-outline" color={color} /> }}
        />
        <Tabs.Screen
          name="progress"
          options={{ title: 'Progress', tabBarIcon: ({ color }) => <Icon name="chart-line" color={color} /> }}
        />
      </Tabs.Protected>
    </Tabs>
  );
}
