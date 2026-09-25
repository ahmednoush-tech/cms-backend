import { getTenantContext } from './tenant-context';

/**
 * Used by EXACTLY TEN call sites in this codebase:
 *
 *   1. JwtStrategy.validate() — its own bootstrap lookup of "which
 *      user does this (already cryptographically verified) JWT
 *      belong to", which is the very thing that DETERMINES which
 *      company's context to set for the rest of the request. There
 *      is no tenant to scope by yet at that exact moment — that's
 *      what this lookup is for.
 *   2. PublicQuotationService.getByToken() — a quotation opened via
 *      its own unguessable UUID share link, before login.
 *   3. PublicCompanyInfoService.get() — the login screen's
 *      name/logo, before anyone has signed in.
 *   4. SignupService.signup() — creating a BRAND NEW company. There
 *      is, by definition, no existing tenant to scope this
 *      operation by.
 *   5. EmailIntegrationService.handleOAuthCallback() — Microsoft's
 *      OAuth redirect carries no Authorization header at all; the
 *      caller is identified only by the short-lived signed `state`
 *      parameter this system itself issued a few minutes earlier,
 *      which is what lets this safely write the new
 *      EmailIntegration row for the correct user/company.
 *   6. SchedulerService.getActiveCompanyIds() — a cron job has no
 *      HTTP request and no JWT at all; it must list every active
 *      company BEFORE it can know which one to scope any of its
 *      per-company work by. Every subsequent per-company
 *      transaction in the same job sets a REAL
 *      app.current_company_id instead — this bypass is used only
 *      for the one query that lists the companies themselves.
 *   7. PlatformAdminAuthService.login() — platform_admins has no
 *      company_id column at all (see migration 080); there is
 *      structurally no tenant to scope this lookup by, for the
 *      same reason as #1 but for Mizan's own ops team rather than
 *      a tenant user.
 *   8. PlatformAdminJwtStrategy.validate() — same reasoning as #7,
 *      applied to validating an already-issued platform admin
 *      token on every subsequent request.
 *   9–10. PlatformAdminCompaniesService.listCompanies() and
 *      .getCompanyDetail() — a platform admin's entire purpose is
 *      to see ACROSS every company; there is no single companyId
 *      to scope these two queries by, by design.
 *
 * Grep `enableRlsBypass` — it should return exactly those ten
 * call sites and nowhere else, ever. Each one already has its own
 * narrow, explicit reason it cannot know a companyId in advance;
 * this is not a general escape hatch.
 */
export async function enableRlsBypass(): Promise<void> {
  const ctx = getTenantContext();
  if (!ctx) return; // no request-scoped transaction open (e.g. a unit test with mocked Prisma) — nothing to bypass
  await ctx.tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
}
