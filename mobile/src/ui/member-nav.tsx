import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { router, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { memberGate } from '../lib/policies';
import { useSession } from '../lib/session';
import { webUrl } from '../lib/web-links';
import { Copy, Divider, Icon, openExternal, useAction } from './components';
import { fonts, useTheme } from './theme';

export function MemberHeaderActions() {
  const theme = useTheme();
  const { profile } = useSession();
  const ready = profile && memberGate(profile) === 'ready';
  return (
    <View style={{ flexDirection: 'row', marginRight: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={theme.isDark ? 'Use light theme' : 'Use dark theme'}
        onPress={theme.toggle}
        style={touch}
      >
        <Icon name={theme.isDark ? 'white-balance-sunny' : 'weather-night'} color={theme.text} size={22} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open notifications"
        disabled={!ready}
        accessibilityState={{ disabled: !ready }}
        onPress={() => router.push('/notifications')}
        style={[touch, { opacity: ready ? 1 : 0.4 }]}
      >
        <Icon name="bell-outline" color={theme.muted} size={24} />
      </Pressable>
    </View>
  );
}
const touch = { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' } as const;
const destinations = [
  ['index', 'Home', 'home-outline'],
  ['meals', 'Meals', 'silverware-fork-knife'],
  ['groceries', 'Groceries', 'basket-outline'],
  ['progress', 'Progress', 'chart-line'],
  ['profile', 'Profile', 'account-circle-outline'],
] as const;

/** The PWA's inset five-item bar. Router state and guards still own destinations. */
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
export function MemberTabBar({ state }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useSession();
  const ready = profile && memberGate(profile) === 'ready';
  const [menu, setMenu] = useState(false);
  const action = useAction();
  const navigate = (destination: '/profile' | '/report' | '/account-help' | '/account') => {
    setMenu(false);
    router.push(destination);
  };
  return (
    <>
      <View style={{ position: 'absolute', bottom: insets.bottom + 12, left: 12, right: 12, alignItems: 'center' }}>
        <View
          style={{
            width: '100%',
            maxWidth: 448,
            flexDirection: 'row',
            gap: 4,
            padding: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            boxShadow: '0px 5px 18px rgba(5,18,14,0.16)',
          }}
        >
          {destinations.map(([name, label, icon]) => {
            const active = name === 'profile' ? menu : !menu && state.routes[state.index]?.name === name;
            const disabled = name !== 'profile' && name !== 'index' && !ready;
            return (
              <Pressable
                key={name}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: active, disabled }}
                onPress={() => {
                  if (name === 'profile') {
                    setMenu(!menu);
                    return;
                  }
                  if (disabled) return;
                  if (!state.routes.some((route) => route.name === name)) return;
                  router.navigate(
                    name === 'index'
                      ? '/'
                      : name === 'meals'
                        ? '/meals'
                        : name === 'groceries'
                          ? '/groceries'
                          : '/progress'
                  );
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 52,
                  minWidth: 44,
                  borderRadius: 13,
                  paddingVertical: 5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  backgroundColor: active ? theme.primary : 'transparent',
                  opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
                })}
              >
                <Icon name={icon} size={21} color={active ? theme.onPrimary : theme.muted} />
                <Copy
                  small
                  style={{
                    fontFamily: fonts.display,
                    fontWeight: '600',
                    fontSize: 10,
                    lineHeight: 14,
                    color: active ? theme.onPrimary : theme.muted,
                  }}
                >
                  {label}
                </Copy>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', padding: 12, paddingBottom: insets.bottom + 92 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close profile menu"
            onPress={() => setMenu(false)}
            style={{ position: 'absolute', inset: 0, backgroundColor: '#00000055' }}
          />
          <View
            accessibilityViewIsModal
            style={{
              width: 288,
              maxWidth: '100%',
              alignSelf: 'flex-end',
              backgroundColor: theme.surface,
              padding: 12,
              borderRadius: 20,
              borderColor: theme.border,
              borderWidth: 1,
              maxHeight: '90%',
            }}
          >
            <ScrollView>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Your profile"
                onPress={() => navigate('/profile')}
                style={{ padding: 12, gap: 4, minHeight: 64 }}
              >
                <Copy style={{ fontWeight: '700' }}>{profile?.name}</Copy>
                <Copy small muted>
                  Member
                </Copy>
              </Pressable>
              <Divider />
              {(
                [
                  [
                    'Membership',
                    'calendar-month-outline',
                    () => {
                      setMenu(false);
                      void action.run(() => openExternal(webUrl('/membership')));
                    },
                  ],
                  ['Personalization', 'account-circle-outline', () => navigate('/profile')],
                  ['Nutrition report', 'silverware-fork-knife', () => navigate('/report')],
                  [
                    'Settings',
                    'account-circle-outline',
                    () => {
                      setMenu(false);
                      router.push({ pathname: '/profile', params: { section: 'settings' } });
                    },
                  ],
                  ['Help & Docs', 'chat-outline', () => navigate('/account-help')],
                  ['Account & privacy', 'account-circle-outline', () => navigate('/account')],
                ] as const
              ).map(([label, icon, press]) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  onPress={press}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 12 }}
                >
                  <Icon name={icon} size={18} color={theme.muted} />
                  <Copy small style={{ fontWeight: '600' }}>
                    {label}
                  </Copy>
                </Pressable>
              ))}
              <Divider />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log out"
                disabled={action.busy}
                style={{ minHeight: 48, padding: 12 }}
                onPress={() =>
                  Alert.alert('Sign out?', 'This revokes this device’s session.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign out', onPress: () => void action.run(signOut) },
                  ])
                }
              >
                <Copy small style={{ color: theme.error, fontWeight: '600' }}>
                  Log out
                </Copy>
              </Pressable>
              {action.error ? (
                <Copy small style={{ color: theme.error }}>
                  {action.error}
                </Copy>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
