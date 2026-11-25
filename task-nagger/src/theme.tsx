import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

export type Palette = {
  dark: boolean;
  bg: string;
  card: string;
  text: string;
  text2: string;
  muted: string;
  faint: string;
  border: string;
  border2: string;
  soft: string;
  cell: string;
};

export const LIGHT: Palette = {
  dark: false,
  bg: '#f1f5f9',
  card: '#ffffff',
  text: '#0f172a',
  text2: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  border: '#e2e8f0',
  border2: '#cbd5e1',
  soft: '#eef2ff',
  cell: '#f8fafc',
};

export const DARK: Palette = {
  dark: true,
  bg: '#0b1020',
  card: '#161c30',
  text: '#f1f5f9',
  text2: '#cbd5e1',
  muted: '#94a3b8',
  faint: '#64748b',
  border: '#263049',
  border2: '#334155',
  soft: '#1e2547',
  cell: '#1b2238',
};

const ThemeContext = createContext<Palette>(LIGHT);

export function ThemeProvider({ mode, children }: { mode: 'system' | 'light' | 'dark'; children: React.ReactNode }) {
  const system = useColorScheme();
  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
  return <ThemeContext.Provider value={dark ? DARK : LIGHT}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** Styles that depend on the palette, rebuilt only when the theme changes. */
export function useStyles<T>(make: (C: Palette) => T): T {
  const C = useTheme();
  return useMemo(() => make(C), [C, make]);
}
