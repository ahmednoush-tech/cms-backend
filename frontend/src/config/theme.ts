import { getBrandingConfig } from './branding';

/**
 * Design token rationale (foundation default, overridden per
 * deployment via branding.ts):
 *   --color-primary:   set by branding.ts (Mizan's product palette:
 *                       a deep slate-blue) — deliberately industry-
 *                       neutral so it reads as trustworthy business
 *                       software for any local company, not coded to
 *                       one sector, and distinct from the generic
 *                       "AI tool" palette defaults (warm terracotta
 *                       on cream, or near-black with neon accent).
 *   --color-secondary: set by branding.ts (a warm gold — a literal
 *                       nod to "mizan"/scale) — used sparingly for
 *                       secondary emphasis (badges, highlights),
 *                       not competing with primary for attention.
 *   --color-surface / surface-muted / border / ink / ink-muted:
 *                       a warm-neutral gray scale (not stark
 *                       white/black), consistent whether primary
 *                       is overridden or not, since these describe
 *                       structure rather than brand identity.
 *   --color-success/warning/danger: standard semantic colors,
 *                       slightly desaturated to sit comfortably
 *                       next to the indigo/amber pair rather than
 *                       clashing with saturated defaults.
 *
 * Applied as CSS custom properties on :root so Tailwind's
 * `rgb(var(--color-x) / <alpha-value>)` pattern (tailwind.config.js)
 * picks them up everywhere without any component knowing whether
 * it's rendering the default theme or a white-labeled one.
 */
const STATIC_TOKENS: Record<string, string> = {
  '--color-surface': '250 250 249',
  '--color-surface-muted': '243 242 239',
  '--color-border': '225 222 216',
  '--color-ink': '26 31 43',
  '--color-ink-muted': '90 97 112',
  '--color-success': '46 125 90',
  '--color-warning': '181 128 30',
  '--color-danger': '178 54 54',
  '--color-primary-fg': '255 255 255',
  '--color-secondary-fg': '26 31 43',
};

/**
 * `override` lets a user-selected theme preset (see
 * config/themePresets.ts) take precedence over the deployment's
 * own branding colors — passed by ThemeProvider whenever the
 * saved preference changes, and by main.tsx on first load so the
 * correct theme paints immediately (no flash of the wrong colors).
 */
export function applyTheme(override?: { primaryColorRgb: string; secondaryColorRgb: string }): void {
  const branding = getBrandingConfig();
  const root = document.documentElement;

  for (const [prop, value] of Object.entries(STATIC_TOKENS)) {
    root.style.setProperty(prop, value);
  }
  root.style.setProperty('--color-primary', override?.primaryColorRgb ?? branding.primaryColorRgb);
  root.style.setProperty('--color-secondary', override?.secondaryColorRgb ?? branding.secondaryColorRgb);
}
