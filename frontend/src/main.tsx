import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme } from './config/theme';
import { getBrandingConfig } from './config/branding';
import { getThemePreset } from './config/themePresets';
import { themeStorage } from './config/themeStorage';
import './i18n';
import './index.css';

// Apply the user's saved color theme (falling back to the
// deployment's own branding colors if none saved yet) + document
// metadata before the app renders, so there's no flash of the
// wrong theme or unbranded styling.
applyTheme(getThemePreset(themeStorage.getThemeId()));
const branding = getBrandingConfig();
// NOT branding.companyName — that field is deliberately empty
// (see branding.ts's comment: it's Sidebar's per-TENANT fallback,
// not Mizan's own name). The browser tab title is product-level
// identity and stays constant regardless of which company is
// logged in, so it's hardcoded here rather than routed through
// i18next (which a component can rely on, but a plain script
// tag's timing relative to i18next's init is not worth coupling
// to for a single static string).
document.title = 'Mizan | ميزان';
const faviconEl = document.getElementById('app-favicon') as HTMLLinkElement | null;
if (faviconEl) faviconEl.href = branding.faviconUrl;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
