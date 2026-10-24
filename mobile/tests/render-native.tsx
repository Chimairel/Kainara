import React from 'react';
import { render as renderNative } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/** Mount screens with the same provider contract as the native root. */
export function render(component: React.ReactElement, options?: Parameters<typeof renderNative>[1]) {
  return renderNative(component, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 24, right: 0, bottom: 24, left: 0 },
        }}
      >
        {children}
      </SafeAreaProvider>
    ),
    ...options,
  });
}
