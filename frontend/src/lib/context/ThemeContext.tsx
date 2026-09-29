'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Access localStorage safely after hydration
    const savedTheme = localStorage.getItem('nutrimind-theme') as Theme | null;
    const current = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'light';
    setTheme(current);
    document.documentElement.classList.toggle('dark', current === 'dark');
    document.documentElement.classList.toggle('light', current === 'light');
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const nextTheme = root.classList.contains('dark') ? 'light' : 'dark';
    root.classList.add('theme-switching');
    setTheme(nextTheme);
    localStorage.setItem('nutrimind-theme', nextTheme);
    root.classList.toggle('dark', nextTheme === 'dark');
    root.classList.toggle('light', nextTheme === 'light');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => root.classList.remove('theme-switching'));
    });
  };

  // During SSR or before mounting, render with default dark styles to prevent mismatch
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
