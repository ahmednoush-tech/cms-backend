import { DEFAULT_THEME_ID } from '../config/themePresets';

const THEME_STORAGE_KEY = 'mizan.themeId';

export const themeStorage = {
  getThemeId(): string {
    return localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME_ID;
  },
  setThemeId(id: string): void {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  },
};
