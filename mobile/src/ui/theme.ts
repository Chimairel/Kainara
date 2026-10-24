import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
export const fonts = { body: 'KainaraBody', display: 'KainaraDisplay', data: 'KainaraData' };
const light = {
  background: '#faf8f5',
  surface: '#ffffff',
  soft: '#f3efe8',
  text: '#0d2820',
  muted: '#5a746a',
  border: '#dce4e0',
  primary: '#eb6a38',
  onPrimary: '#0d2820',
  green: '#08705b',
  greenSoft: '#dff6ed',
  carbs: '#0b7788',
  error: '#ad2424',
  errorSoft: '#fff0ec',
};
const dark = {
  background: '#071914',
  surface: '#0e271f',
  soft: '#0b231c',
  text: '#eff8f3',
  muted: '#8ea99f',
  border: '#173e33',
  primary: '#eb6a38',
  onPrimary: '#0d2820',
  green: '#10b981',
  greenSoft: '#164639',
  carbs: '#38bdf8',
  error: '#ffb4ab',
  errorSoft: '#421f1c',
};
const AppearanceContext = createContext<{ appearance: 'light' | 'dark' | null; toggle(): void }>({
  appearance: null,
  toggle() {},
});
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [appearance, setAppearance] = useState<'light' | 'dark' | null>(null);
  return React.createElement(
    AppearanceContext.Provider,
    {
      value: { appearance, toggle: () => setAppearance((appearance ?? system) === 'dark' ? 'light' : 'dark') },
    },
    children
  );
}
export function useTheme() {
  const { appearance, toggle } = useContext(AppearanceContext);
  const isDark = useColorScheme() === 'dark';
  const darkMode = appearance ? appearance === 'dark' : isDark;
  return { ...(darkMode ? dark : light), isDark: darkMode, toggle };
}
