import React from 'react';
import { Tabs, router } from 'expo-router';
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Copy, Icon } from '../../../ui/components';
import { fonts, useTheme } from '../../../ui/theme';
import { useSession } from '../../../lib/session';
import { memberGate } from '../../../lib/policies';

export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const ready = profile && memberGate(profile) === 'ready';
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.onPrimary,
        tabBarActiveBackgroundColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
          height: 72 + insets.bottom,
        },
        tabBarItemStyle: {
          marginHorizontal: 4,
          borderRadius: 16,
          overflow: 'hidden',
          paddingVertical: 4,
          minHeight: 52,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.display, fontWeight: '600' },
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        headerTitle: ({ children }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image
              source={require('../../../../assets/kainara-icon.png')}
              accessible={false}
              style={{ width: 32, height: 32, borderRadius: 16 }}
            />
            <View>
              <Copy small style={{ fontFamily: fonts.display, fontWeight: '800', letterSpacing: 1 }}>
                KAINARA
              </Copy>
              <Copy small muted style={{ fontSize: 11, lineHeight: 15 }}>
                {children}
              </Copy>
            </View>
          </View>
        ),
        headerRight: () => (
          <View style={{ flexDirection: 'row', marginRight: 6 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={theme.isDark ? 'Use light theme' : 'Use dark theme'}
              onPress={theme.toggle}
              style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name={theme.isDark ? 'white-balance-sunny' : 'weather-night'} color={theme.text} size={23} />
            </Pressable>
            {ready ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open notifications"
                onPress={() => router.push('/notifications')}
                style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="bell-outline" color={theme.text} size={24} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open your profile"
              style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => router.push('/profile')}
            >
              <Icon name="account-circle-outline" />
            </Pressable>
          </View>
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
