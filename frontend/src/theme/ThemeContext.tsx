import { createContext, useContext, useEffect, useState } from 'react';
import { applyTheme } from '../config/theme';
import { getThemePreset } from '../config/themePresets';
import { themeStorage } from '../config/themeStorage';

interface ThemeContextValue {
  themeId: string;
  setThemeId: (id: string) => void;
}

const ThemeReactContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>(() => themeStorage.getThemeId());

  useEffect(() => {
    applyTheme(getThemePreset(themeId));
  }, [themeId]);

  const setThemeId = (id: string) => {
    themeStorage.setThemeId(id);
    setThemeIdState(id);
  };

  return <ThemeReactContext.Provider value={{ themeId, setThemeId }}>{children}</ThemeReactContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeReactContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>.');
  }
  return ctx;
}
