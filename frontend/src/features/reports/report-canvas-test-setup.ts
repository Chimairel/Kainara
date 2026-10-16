import { vi } from 'vitest';
vi.mock('@/lib/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));
