import { apiRequest } from '../client';
import type { PaginatedFilters, PaginationMeta } from '../../types/api';
import type { Employee, CreateEmployeeInput, UpdateEmployeeInput, ExpiringIqamasResult } from '../../types/entities/administration';

/**
 * Confirmed 1:1 against backend/src/modules/employees/employees.controller.ts.
 * Search/pagination/sort plus an optional departmentId filter
 * (added so a department's detail page can list its own
 * employees without over-fetching the whole company). `linkUser`
 * is one-directional and additive — there is no unlink endpoint
 * (confirmed this session, a real backend gap, see Phase 3E report).
 */
export const employeesApi = {
  list: async (filters: PaginatedFilters & { departmentId?: string }): Promise<{ items: Employee[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<Employee[]>({ method: 'GET', url: '/employees', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<Employee> => {
    const { data } = await apiRequest<Employee>({ method: 'GET', url: `/employees/${id}` });
    return data;
  },
  create: async (input: CreateEmployeeInput): Promise<Employee> => {
    const { data } = await apiRequest<Employee>({ method: 'POST', url: '/employees', data: input });
    return data;
  },
  update: async (id: string, input: UpdateEmployeeInput): Promise<Employee> => {
    const { data } = await apiRequest<Employee>({ method: 'PATCH', url: `/employees/${id}`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/employees/${id}` });
  },
  linkUser: async (id: string, userId: string): Promise<Employee> => {
    const { data } = await apiRequest<Employee>({ method: 'POST', url: `/employees/${id}/link-user`, data: { userId } });
    return data;
  },
  checkExpiringIqamas: async (daysThreshold?: number): Promise<ExpiringIqamasResult> => {
    const { data } = await apiRequest<ExpiringIqamasResult>({ method: 'GET', url: '/employees/expiring-iqamas', params: { daysThreshold } });
    return data;
  },
};
