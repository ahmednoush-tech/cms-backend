import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as not requiring authentication.
 * JwtAuthGuard is registered globally in app.module.ts, so every
 * route is authenticated by default; @Public() is the explicit
 * opt-out, used only where there is genuinely no user identity to
 * check yet — login/refresh, the public quotation share link, the
 * public company-info endpoint (login-screen branding), and the
 * health check.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
