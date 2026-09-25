/**
 * MIZAN'S OWN product branding — deliberately NOT per-tenant.
 *
 * Mizan is a shared multi-tenant product: one deployment serves
 * many companies (see the backend's RLS-based tenant isolation).
 * The values here are the ONE product-wide identity (name, logo,
 * color palette) shown before login and as the fallback everywhere
 * else — never a specific customer's own branding.
 *
 * A logged-in company's own name/logo now comes from the real
 * `GET /company-settings` endpoint via useCompanyInfo() (see
 * Sidebar.tsx), and the pre-login equivalent — showing a specific
 * vendor company's branding on THEIR customer-facing portal, e.g.
 * PortalLayout.tsx — uses the public `usePublicCompanyInfo()`
 * variant. Neither reads this file for that purpose; this file's
 * companyName/logoUrl are used only as their brief loading-state
 * fallback (see the empty-string rationale on companyName below).
 *
 * ISOLATION CONTRACT: nothing outside this file and theme.ts
 * should read import.meta.env directly for branding values, and
 * no component should hardcode Mizan's own name/color/logo path —
 * always go through `getBrandingConfig()`.
 */

export interface BrandingConfig {
  companyName: string;
  logoUrl: string;
  faviconUrl: string;
  /** RGB triplet as "r g b" (Tailwind's `rgb(var(--x) / <alpha>)` convention) */
  primaryColorRgb: string;
  secondaryColorRgb: string;
  defaultLanguage: 'en' | 'ar';
  /**
   * Legal/contact details for printed documents (quotation PDFs).
   * All optional — a deployment that hasn't set these simply omits
   * them from the printed header rather than showing blank lines.
   * Same deploy-time-config approach as the rest of this file, for
   * the same reason (no Companies endpoint to fetch this from).
   */
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyTaxNumber: string;
}

const DEFAULT_BRANDING: BrandingConfig = {
  // NOT Mizan's own name — this is Sidebar's fallback for the
  // TENANT company's name during the brief moment before
  // useCompanyInfo() resolves (or if it fails). Mizan's own
  // identity lives separately in ProductBar.tsx via the
  // common:productName/productTagline translation keys, which are
  // never sourced from this file. Left empty on purpose: a blank
  // sidebar header for a split second is honest about "still
  // loading" — showing any placeholder text here risks it being
  // mistaken for a real (wrong) company name.
  companyName: '',
  logoUrl: '/logo.svg',
  faviconUrl: '/favicon.svg',
  // MIZAN product palette — deep slate-blue primary (trustworthy,
  // industry-neutral so it fits any local company's business, not
  // coded to one sector) with a warm gold secondary (a literal nod
  // to "mizan" / scale, used sparingly for emphasis).
  primaryColorRgb: '43 76 111', // #2B4C6F
  secondaryColorRgb: '201 162 75', // #C9A24B
  defaultLanguage: 'ar',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  companyTaxNumber: '',
};

let cached: BrandingConfig | null = null;

/**
 * Reads deployment env vars if present, otherwise falls back to
 * DEFAULT_BRANDING. This is the ONLY function anything in the app
 * should call to get branding — never `import.meta.env` directly.
 */
export function getBrandingConfig(): BrandingConfig {
  if (cached) return cached;

  cached = {
    companyName: import.meta.env.VITE_BRAND_COMPANY_NAME ?? DEFAULT_BRANDING.companyName,
    logoUrl: import.meta.env.VITE_BRAND_LOGO_URL ?? DEFAULT_BRANDING.logoUrl,
    faviconUrl: import.meta.env.VITE_BRAND_FAVICON_URL ?? DEFAULT_BRANDING.faviconUrl,
    primaryColorRgb: import.meta.env.VITE_BRAND_PRIMARY_RGB ?? DEFAULT_BRANDING.primaryColorRgb,
    secondaryColorRgb: import.meta.env.VITE_BRAND_SECONDARY_RGB ?? DEFAULT_BRANDING.secondaryColorRgb,
    defaultLanguage:
      (import.meta.env.VITE_BRAND_DEFAULT_LANGUAGE as 'en' | 'ar' | undefined) ??
      DEFAULT_BRANDING.defaultLanguage,
    companyAddress: import.meta.env.VITE_BRAND_COMPANY_ADDRESS ?? DEFAULT_BRANDING.companyAddress,
    companyPhone: import.meta.env.VITE_BRAND_COMPANY_PHONE ?? DEFAULT_BRANDING.companyPhone,
    companyEmail: import.meta.env.VITE_BRAND_COMPANY_EMAIL ?? DEFAULT_BRANDING.companyEmail,
    companyTaxNumber: import.meta.env.VITE_BRAND_COMPANY_TAX_NUMBER ?? DEFAULT_BRANDING.companyTaxNumber,
  };

  return cached;
}
