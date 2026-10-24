import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Copy } from './components';
import { useTheme } from './theme';

/** Center cell of the same 3x3 direction atlas used by the web Nara portrait. */
export function NaraPortrait({ size = 64 }: { size?: number }) {
  return (
    <View accessible={false} style={{ width: size, height: size, overflow: 'hidden' }}>
      <Image
        source={require('../../assets/nara-default-directions.webp')}
        accessible={false}
        style={{ position: 'absolute', width: size * 3, height: size * 3, left: -size, top: -size }}
      />
    </View>
  );
}

export function NaraShortcut() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ask Nara"
      onPress={() => router.push('/nara')}
      style={({ pressed }) => ({
        alignSelf: 'flex-end',
        alignItems: 'center',
        opacity: pressed ? 0.7 : 1,
        minHeight: 64,
      })}
    >
      <NaraPortrait size={72} />
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 2,
          borderRadius: 14,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        <Copy small style={{ fontSize: 11, fontWeight: '700' }}>
          Ask Nara
        </Copy>
      </View>
    </Pressable>
  );
}
