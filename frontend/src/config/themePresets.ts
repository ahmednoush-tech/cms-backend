export interface ThemePreset {
  id: string;
  /** Translation key under common:themes.<id> */
  labelKey: string;
  primaryColorRgb: string;
  secondaryColorRgb: string;
}

/**
 * Every preset keeps Mizan's own name/logo unchanged — a theme
 * only ever changes --color-primary/--color-secondary (see
 * config/theme.ts). This is a short, curated list (not an open
 * color picker): each entry is a chosen primary+secondary pair.
 */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'mizan',
    labelKey: 'mizan',
    primaryColorRgb: '43 76 111', // #2B4C6F — deep slate-blue
    secondaryColorRgb: '201 162 75', // #C9A24B — warm gold
  },
  {
    id: 'emerald',
    labelKey: 'emerald',
    primaryColorRgb: '15 92 71', // #0F5C47 — deep emerald
    secondaryColorRgb: '197 149 60', // #C5953C — warm amber
  },
  {
    id: 'plum',
    labelKey: 'plum',
    primaryColorRgb: '74 42 88', // #4A2A58 — deep plum
    secondaryColorRgb: '199 139 140', // #C78B8C — dusty rose
  },
  {
    id: 'charcoal',
    labelKey: 'charcoal',
    primaryColorRgb: '30 35 42', // #1E232A — near-black charcoal
    secondaryColorRgb: '61 182 175', // #3DB6AF — cyan
  },
  {
    id: 'terracotta',
    labelKey: 'terracotta',
    primaryColorRgb: '166 79 46', // #A64F2E — warm rust/copper
    secondaryColorRgb: '222 184 135', // #DEB887 — warm sand
  },
  {
    id: 'ocean',
    labelKey: 'ocean',
    primaryColorRgb: '16 54 82', // #103652 — deep navy
    secondaryColorRgb: '224 122 95', // #E07A5F — warm coral
  },
  {
    id: 'burgundy',
    labelKey: 'burgundy',
    primaryColorRgb: '94 23 41', // #5E1729 — deep wine
    secondaryColorRgb: '196 154 87', // #C49A57 — warm brass
  },
];

export const DEFAULT_THEME_ID = 'mizan';

export function getThemePreset(id: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0];
}
