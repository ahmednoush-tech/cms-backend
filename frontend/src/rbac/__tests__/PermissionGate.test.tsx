import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionGate } from '../PermissionGate';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Written as real, runnable Vitest + React Testing Library code.
 */

vi.mock('../usePermissions', () => ({
  usePermissions: () => ({
    hasAnyPermission: (perms: string[]) => perms.includes('CRM:customers:view'),
    hasAllPermissions: (perms: string[]) => perms.every((p) => p === 'CRM:customers:view'),
  }),
}));

describe('PermissionGate', () => {
  it('renders children when the required permission is present', () => {
    render(
      <PermissionGate requires="CRM:customers:view">
        <button>Create Customer</button>
      </PermissionGate>,
    );
    expect(screen.getByText('Create Customer')).toBeInTheDocument();
  });

  it('renders nothing (not a disabled button) when the permission is missing', () => {
    render(
      <PermissionGate requires="CRM:customers:delete">
        <button>Delete</button>
      </PermissionGate>,
    );
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('supports matchAny for the lead-conversion dual-permission case', () => {
    render(
      <PermissionGate requires={['CRM:customers:view', 'CRM:leads:edit']} matchAny>
        <button>Convert</button>
      </PermissionGate>,
    );
    // hasAnyPermission mock returns true since 'CRM:customers:view' is in the list
    expect(screen.getByText('Convert')).toBeInTheDocument();
  });

  it('renders the fallback when provided and the check fails', () => {
    render(
      <PermissionGate requires="CRM:customers:delete" fallback={<span>No access</span>}>
        <button>Delete</button>
      </PermissionGate>,
    );
    expect(screen.getByText('No access')).toBeInTheDocument();
  });
});
