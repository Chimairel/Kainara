import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as WebBrowser from 'expo-web-browser';
import { fonts, useTheme } from './theme';
import { safeExternalUrl } from '../lib/policies';
import { message } from '../lib/session';

export function Copy({
  children,
  muted = false,
  title = false,
  small = false,
  selectable = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  title?: boolean;
  small?: boolean;
  selectable?: boolean;
  style?: StyleProp<import('react-native').TextStyle>;
}) {
  const theme = useTheme();
  return (
    <Text
      selectable={selectable}
      style={[
        {
          color: muted ? theme.muted : theme.text,
          fontSize: title ? 28 : small ? 13 : 16,
          lineHeight: title ? 35 : small ? 19 : 24,
          fontWeight: title ? '700' : '400',
          fontFamily: title ? fonts.display : fonts.body,
          flexShrink: 1,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Icon({
  name,
  size = 24,
  color,
}: {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  size?: number;
  color?: import('react-native').ColorValue | null;
}) {
  const theme = useTheme();
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={typeof color === 'number' ? theme.green : (color ?? theme.green)}
      accessible={false}
    />
  );
}
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
  icon,
}: {
  label: string;
  onPress(): void | Promise<void>;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={() => {
        void Promise.resolve(onPress()).catch((error) => Alert.alert('Could not complete this action', message(error)));
      }}
      style={({ pressed }) => [
        {
          minHeight: 52,
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: 28,
          backgroundColor: secondary ? '#ffffff' : theme.primary,
          boxShadow: '0px 3px 9px rgba(5,18,14,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 10,
          opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={theme.onPrimary} />
      ) : icon ? (
        <Icon name={icon} color={theme.onPrimary} size={21} />
      ) : null}
      <Text
        style={{
          color: theme.onPrimary,
          fontSize: 16,
          fontWeight: '700',
          fontFamily: fonts.display,
          textAlign: 'center',
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 24,
          padding: 20,
          gap: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Copy small style={{ fontWeight: '600' }}>
        {label}
      </Copy>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={theme.muted}
        selectionColor={theme.green}
        style={[
          {
            minHeight: 52,
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: theme.text,
            fontSize: 16,
            fontFamily: fonts.body,
          },
          props.multiline && { minHeight: 112, textAlignVertical: 'top' },
          props.style,
        ]}
      />
    </View>
  );
}
export function Screen({
  children,
  refreshing = false,
  onRefresh,
  keyboard = false,
  floating,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboard?: boolean;
  floating?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={keyboard ? (Platform.OS === 'ios' ? 'padding' : 'height') : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 20,
            paddingBottom: floating ? 116 : 40,
            gap: 24,
            flexGrow: 1,
            width: '100%',
            maxWidth: 760,
            alignSelf: 'center',
          }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.green}
                colors={[theme.green]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      {floating ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', right: 16, bottom: 12 }}>
          {floating}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
export function Busy({ label = 'Loading your information…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      style={{
        flex: 1,
        padding: 30,
        gap: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.background,
      }}
    >
      <ActivityIndicator color={theme.green} size="large" />
      <Copy muted>{label}</Copy>
    </View>
  );
}
export function Notice({
  title,
  body,
  error = false,
  onRetry,
}: {
  title: string;
  body: string;
  error?: boolean;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  return (
    <Panel style={{ backgroundColor: error ? theme.errorSoft : theme.greenSoft }}>
      <Icon name={error ? 'alert-circle-outline' : 'information-outline'} color={error ? theme.error : theme.green} />
      <Copy style={{ fontWeight: '700' }}>{title}</Copy>
      <Copy muted>{body}</Copy>
      {onRetry ? <Button label="Try again" secondary onPress={onRetry} /> : null}
    </Panel>
  );
}
export function Choice({
  label,
  options,
  value,
  onChange,
  segmented = false,
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  value: string;
  onChange(value: string): void;
  segmented?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {!segmented ? (
        <Copy small style={{ fontWeight: '600' }}>
          {label}
        </Copy>
      ) : null}
      <View
        accessibilityLabel={label}
        style={
          segmented
            ? {
                padding: 5,
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderWidth: 1,
                borderRadius: 22,
                gap: 4,
                flexDirection: 'row',
                flexWrap: 'wrap',
              }
            : { gap: 8, flexDirection: 'row', flexWrap: 'wrap' }
        }
      >
        {options.map(([key, text]) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={text}
            accessibilityState={{ checked: key === value }}
            onPress={() => onChange(key)}
            style={{
              minHeight: 48,
              padding: segmented ? 10 : 12,
              borderRadius: segmented ? 18 : 14,
              flex: segmented ? 1 : undefined,
              minWidth: segmented ? 70 : undefined,
              alignItems: segmented ? 'center' : undefined,
              backgroundColor: key === value ? (segmented ? theme.primary : theme.greenSoft) : theme.surface,
              borderColor: key === value ? theme.green : theme.border,
              borderWidth: segmented ? 0 : 1,
              justifyContent: 'center',
            }}
          >
            <Copy
              small
              style={{
                fontFamily: segmented ? fonts.display : fonts.body,
                color: segmented && key === value ? theme.onPrimary : theme.text,
                fontWeight: key === value ? '700' : '400',
              }}
            >
              {text}
            </Copy>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />;
}
export async function openExternal(url: string) {
  const safe = safeExternalUrl(url);
  if (!safe) throw new Error('This link is unavailable.');
  await WebBrowser.openBrowserAsync(safe);
}
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  return {
    busy,
    error,
    setError,
    run: async (action: () => Promise<void>) => {
      if (active.current) return;
      active.current = true;
      setBusy(true);
      setError(null);
      try {
        await action();
      } catch (cause) {
        setError(message(cause));
      } finally {
        active.current = false;
        setBusy(false);
      }
    },
  };
}
