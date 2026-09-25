import { apiRequest } from '../client';
import type {
  Role,
  CreateRoleInput,
  AssignPermissionsInput,
  AssignRoleInput,
  Permission,
} from '../../types/entities/administration';

/**
 * Confirmed 1:1 against backend/src/modules/roles/roles.controller.ts.
 * NOTE: there is no PATCH /roles/:id and no DELETE /roles/:id —
 * roles can only be created and read, never renamed or deleted
 * (confirmed this session, a real backend gap — see Phase 3E
 * report). `assignPermissions` is additive-only (upsert per ID);
 * there is no endpoint to remove a permission from a role.
 * `findAll` takes no pagination/filter params — confirmed the
 * controller signature has none (roles are typically few per
 * company, unlike the paginated resources elsewhere).
 */
export const rolesApi = {
  list: async (): Promise<Role[]> => {
    const { data } = await apiRequest<Role[]>({ method: 'GET', url: '/roles' });
    return data;
  },
  get: async (id: string): Promise<Role> => {
    const { data } = await apiRequest<Role>({ method: 'GET', url: `/roles/${id}` });
    return data;
  },
  create: async (input: CreateRoleInput): Promise<Role> => {
    const { data } = await apiRequest<Role>({ method: 'POST', url: '/roles', data: input });
    return data;
  },
  assignPermissions: async (id: string, input: AssignPermissionsInput): Promise<unknown> => {
    const { data } = await apiRequest<unknown>({ method: 'POST', url: `/roles/${id}/permissions`, data: input });
    return data;
  },
  assignToUser: async (input: AssignRoleInput): Promise<unknown> => {
    const { data } = await apiRequest<unknown>({ method: 'POST', url: '/roles/assign', data: input });
    return data;
  },
  removeFromUser: async (userId: string, roleId: string, scopeId?: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/roles/user/${userId}/role/${roleId}`, params: scopeId ? { scopeId } : undefined });
  },
};

/** Confirmed 1:1 against backend/src/modules/roles/permissions.controller.ts — a single read-all endpoint, global reference data (not company-scoped). */
export const permissionsApi = {
  list: async (): Promise<Permission[]> => {
    const { data } = await apiRequest<Permission[]>({ method: 'GET', url: '/permissions' });
    return data;
  },
};
