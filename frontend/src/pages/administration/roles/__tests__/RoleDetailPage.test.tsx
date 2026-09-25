import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
import { RoleDetailPage } from '../RoleDetailPage';
import * as useRolesModule from '../../../../api/queries/useRoles';
import * as useAdminUsersModule from '../../../../api/queries/useAdminUsers';
import * as useDepartmentsModule from '../../../../api/queries/useDepartments';
import * as usePermissionsModule from '../../../../rbac/usePermissions';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * The most important test in this file proves the additive-only
 * constraint: an already-granted permission never appears as a
 * removable/uncheckable item anywhere on this page, because no
 * backend endpoint exists to remove one.
 */

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/admin/roles/role-1']}>
          <Routes>
            <Route path="/admin/roles/:id" element={<RoleDetailPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

function mockRole() {
  vi.spyOn(useRolesModule, 'useRole').mockReturnValue({
    data: {
      id: 'role-1',
      name: 'Sales',
      description: 'Sales team role',
      rolePermissions: [
        {
          roleId: 'role-1',
          permissionId: 'perm-1',
          permission: { id: 'perm-1', module: 'CRM', resource: 'customers', action: 'view' },
        },
      ],
    },
    isLoading: false,
    error: null,
  } as any);
  vi.spyOn(useRolesModule, 'usePermissionsList').mockReturnValue({
    data: [
      { id: 'perm-1', module: 'CRM', resource: 'customers', action: 'view' },
      { id: 'perm-2', module: 'CRM', resource: 'customers', action: 'edit' },
      { id: 'perm-3', module: 'Operations', resource: 'projects', action: 'view' },
    ],
    isLoading: false,
  } as any);
  vi.spyOn(useRolesModule, 'useAssignPermissions').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.spyOn(useRolesModule, 'useAssignRoleToUser').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.spyOn(useRolesModule, 'useRemoveRoleFromUser').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.spyOn(useAdminUsersModule, 'useAdminUsers').mockReturnValue({
    data: { items: [{ id: 'user-1', name: 'Ahmed', email: 'ahmed@example.com' }], meta: {} },
    isLoading: false,
  } as any);
  vi.spyOn(useDepartmentsModule, 'useDepartments').mockReturnValue({
    data: { items: [{ id: 'dept-1', name: 'Sales' }], meta: {} },
    isLoading: false,
  } as any);
}

function allowAll() {
  vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
}

describe('RoleDetailPage — additive-only permission assignment', () => {
  it('shows the already-granted permission in the read-only "Granted" list, not as a checkbox', () => {
    mockRole();
    allowAll();

    renderPage();
    // Granted permission appears as a plain badge (no checkbox nearby)
    expect(screen.getByText('customers:view')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    // Only the two NOT-yet-granted permissions (perm-2, perm-3) get checkboxes
    expect(checkboxes.length).toBe(2);
  });

  it('only lists NOT-yet-granted permissions in the "Add Permissions" checklist', () => {
    mockRole();
    allowAll();

    renderPage();
    expect(screen.getByText('customers:edit')).toBeInTheDocument();
    expect(screen.getByText('projects:view')).toBeInTheDocument();
    // customers:view (already granted) must not appear a second time as a checkbox option
    const checkboxLabels = screen.getAllByRole('checkbox').map((el) => el.closest('label')?.textContent);
    expect(checkboxLabels).not.toContain('customers:view');
  });

  it('there is no "remove permission" control anywhere on the page (no backend endpoint exists for it)', () => {
    mockRole();
    allowAll();

    renderPage();
    expect(screen.queryByText(/remove permission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/revoke permission/i)).not.toBeInTheDocument();
  });

  it('the grant button is disabled until at least one permission is checked', () => {
    mockRole();
    allowAll();

    renderPage();
    const grantButton = screen.getByText(/Grant 0 Selected/);
    expect(grantButton.closest('button')).toBeDisabled();

    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);
    expect(screen.getByText(/Grant 1 Selected/)).toBeInTheDocument();
  });

  it('hides the entire "Add Permissions" and "Assign to User" sections when the caller lacks Administration:roles:manage', () => {
    mockRole();
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
    });

    renderPage();
    expect(screen.queryByText('Add Permissions')).not.toBeInTheDocument();
    expect(screen.queryByText('Assign This Role to a User')).not.toBeInTheDocument();
    // Granted list remains visible (read-only, no permission needed to view what's already there)
    expect(screen.getByText('customers:view')).toBeInTheDocument();
  });

  it('groups both granted and available permissions by module', () => {
    mockRole();
    allowAll();

    renderPage();
    // The default test i18n instance renders English, and
    // en/roles.json has no "module" key for CRM/Operations, so
    // the label falls back to the raw module string (t()'s
    // defaultValue) — same text as before this page started
    // translating module labels. The Arabic path (real
    // translations, fixed module order) is covered separately
    // below.
    expect(screen.getAllByText('CRM').length).toBeGreaterThan(0);
    expect(screen.getByText('Operations')).toBeInTheDocument();
  });

  it('renders translated module labels in the fixed sidebar-matching order when the language is Arabic', async () => {
    mockRole();
    allowAll();
    // Awaited: changeLanguage() is async, and rendering before it
    // resolves would race the very first render pass (see
    // src/test/testUtils.tsx for the prior bug this exact mistake
    // caused elsewhere). Reset back to English afterward so this
    // test doesn't leak Arabic into every other test in this file,
    // all of which assert English text.
    await i18n.changeLanguage('ar');
    try {
      renderPage();
      const crmLabel = screen.getAllByText('إدارة علاقات العملاء')[0];
      const operationsLabel = screen.getByText('العمليات');
      // CRM must appear before Operations in the DOM, matching
      // MODULE_ORDER — not just that both labels exist.
      expect(crmLabel.compareDocumentPosition(operationsLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    } finally {
      await i18n.changeLanguage('en');
    }
  });
});
