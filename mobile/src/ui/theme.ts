import { useColorScheme } from 'react-native';
const light = {
  background: '#faf8f5',
  surface: '#ffffff',
  soft: '#f1eee7',
  text: '#0d2820',
  muted: '#526c62',
  border: '#d9e2dd',
  primary: '#eb6a38',
  onPrimary: '#0d2820',
  green: '#08705b',
  greenSoft: '#e6f1ec',
  error: '#ad2424',
  errorSoft: '#fff0ec',
};
const dark = {
  background: '#071914',
  surface: '#0e271f',
  soft: '#16362b',
  text: '#eff8f3',
  muted: '#abc0b6',
  border: '#2b5142',
  primary: '#f18b60',
  onPrimary: '#0d2820',
  green: '#63d5b2',
  greenSoft: '#153a2d',
  error: '#ffb4ab',
  errorSoft: '#421f1c',
};
export function useTheme() {
  const isDark = useColorScheme() === 'dark';
  return { ...(isDark ? dark : light), isDark };
}
