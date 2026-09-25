import { apiRequest } from '../client';
import type { PaginatedFilters, PaginationMeta } from '../../types/api';
import type { Department, CreateDepartmentInput, UpdateDepartmentInput } from '../../types/entities/administration';

/** Confirmed 1:1 against backend/src/modules/departments/departments.controller.ts. No filter DTO — search/pagination/sort only. */
export const departmentsApi = {
  list: async (filters: PaginatedFilters): Promise<{ items: Department[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<Department[]>({ method: 'GET', url: '/departments', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<Department> => {
    const { data } = await apiRequest<Department>({ method: 'GET', url: `/departments/${id}` });
    return data;
  },
  create: async (input: CreateDepartmentInput): Promise<Department> => {
    const { data } = await apiRequest<Department>({ method: 'POST', url: '/departments', data: input });
    return data;
  },
  update: async (id: string, input: UpdateDepartmentInput): Promise<Department> => {
    const { data } = await apiRequest<Department>({ method: 'PATCH', url: `/departments/${id}`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/departments/${id}` });
  },
};
