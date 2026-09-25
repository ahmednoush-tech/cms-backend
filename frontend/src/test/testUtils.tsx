import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../i18n';
import { AuthReactContext, type SessionStatus } from '../auth/AuthContext';
import type { AuthContext as AuthContextShape } from '../types/auth';

/**
 * Phase 3F — shared test rendering utility. Built specifically so
 * that components using useAuth()/usePermissions()/PermissionGate
 * exercise their REAL implementation against a REAL AuthContext
 * value in every test — never a mocked `usePermissions` hook and
 * never a stubbed-out PermissionGate. This is what "faithfully
 * matches the existing AuthContext contract" means in practice:
 * the exact same `AuthContextValue` shape (`status`, `user`,
 * `login`, `logout`) that `AuthProvider.tsx` actually provides,
 * with `user.permissions` as the one field tests actually vary.
 *
 * Router and QueryClient are bundled in unconditionally too, since
 * nearly every page under test needs both regardless of whether
 * this specific test also touches auth — one shared wrapper avoids
 * the previous inconsistent per-file duplication (some files had
 * Router but not Auth, others had neither, causing the exact
 * `useLocation()`/`useAuth()` context-missing crashes this phase
 * exists to fix).
 */

export function buildTestUser(overrides: Partial<AuthContextShape> = {}): AuthContextShape {
  return {
    sub: 'test-user-id',
    companyId: 'test-company-id',
    email: 'test@example.com',
    roles: [],
    permissions: [],
    isCustomerUser: false,
    ...overrides,
  };
}

interface RenderWithProvidersOptions {
  /** Initial MemoryRouter route. Default: '/'. */
  route?: string;
  /**
   * When set, wraps `ui` in <Routes><Route path={routePath} element={ui}/></Routes>
   * instead of rendering it directly — required for any page using
   * useParams() (every *DetailPage), so the router can actually
   * populate the param from `route`. Omit for list pages, which
   * don't need param matching.
   */
  routePath?: string;
  /** Shorthand for the common case: an authenticated user with exactly these permissions. */
  permissions?: string[];
  /** Full control when a test needs specific non-permission fields (employeeId, isCustomerUser, etc). Overrides `permissions` if both are given. */
  user?: AuthContextShape | null;
  /** Default: 'authenticated'. Set to 'unauthenticated' or 'checking' to exercise those states. */
  status?: SessionStatus;
  language?: 'en' | 'ar';
}

export async function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const { route = '/', routePath, permissions, user, status = 'authenticated', language = 'en' } = options;
  // i18next's changeLanguage() is asynchronous — awaiting it here
  // (rather than firing-and-forgetting, as the pre-Phase-3F Arabic
  // tests did) guarantees the language switch has actually
  // completed before render() runs, so the very first render pass
  // uses the correct language instead of racing it. This was never
  // exercised before: every Arabic test that used this pattern
  // previously crashed earlier (missing AuthProvider) before ever
  // reaching an assertion that could have exposed the race.
  await i18n.changeLanguage(language);

  const resolvedUser: AuthContextShape | null =
    user !== undefined ? user : status === 'authenticated' ? buildTestUser({ permissions: permissions ?? [] }) : null;

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const authValue = {
    status,
    user: resolvedUser,
    login: async () => {},
    logout: async () => {},
  };

  const routedUi = routePath ? (
    <Routes>
      <Route path={routePath} element={ui} />
    </Routes>
  ) : (
    ui
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <AuthReactContext.Provider value={authValue}>
          <MemoryRouter initialEntries={[route]}>{routedUi}</MemoryRouter>
        </AuthReactContext.Provider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}
