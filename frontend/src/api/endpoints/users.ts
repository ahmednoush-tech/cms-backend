import { apiRequest } from '../client';
import type { PaginatedFilters, PaginationMeta } from '../../types/api';
import type { AdminUser, CreateUserInput, UpdateUserInput, GrantPermissionInput } from '../../types/entities/administration';

/**
 * Confirmed 1:1 against backend/src/modules/users/users.controller.ts.
 * No filter DTO. `setPassword` is a separate endpoint from
 * `update` — UpdateUserDto still has no password field, by
 * design, so a generic PATCH can never accidentally change a
 * password; only the dedicated endpoint below can.
 */
export const usersApi = {
  list: async (filters: PaginatedFilters): Promise<{ items: AdminUser[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<AdminUser[]>({ method: 'GET', url: '/users', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<AdminUser> => {
    const { data } = await apiRequest<AdminUser>({ method: 'GET', url: `/users/${id}` });
    return data;
  },
  create: async (input: CreateUserInput): Promise<AdminUser> => {
    const { data } = await apiRequest<AdminUser>({ method: 'POST', url: '/users', data: input });
    return data;
  },
  update: async (id: string, input: UpdateUserInput): Promise<AdminUser> => {
    const { data } = await apiRequest<AdminUser>({ method: 'PATCH', url: `/users/${id}`, data: input });
    return data;
  },
  setPassword: async (id: string, newPassword: string): Promise<{ message: string }> => {
    const { data } = await apiRequest<{ message: string }>({ method: 'PATCH', url: `/users/${id}/password`, data: { newPassword } });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/users/${id}` });
  },
  grantPermission: async (id: string, input: GrantPermissionInput): Promise<unknown> => {
    const { data } = await apiRequest<unknown>({ method: 'POST', url: `/users/${id}/permissions`, data: input });
    return data;
  },
  revokePermission: async (id: string, permissionId: string, scopeId?: string): Promise<void> => {
    await apiRequest<void>({
      method: 'DELETE',
      url: `/users/${id}/permissions/${permissionId}`,
      params: scopeId ? { scopeId } : undefined,
    });
  },
};
