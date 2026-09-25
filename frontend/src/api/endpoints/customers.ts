import { apiRequest } from '../client';
import type { PaginatedFilters, PaginationMeta } from '../../types/api';
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from '../../types/entities/customer';
import type { DuplicateCandidate, CheckDuplicatesInput } from '../../types/entities/duplicateCandidate';

/** Confirmed 1:1 against backend/src/modules/customers/customers.controller.ts. No status filter exists on GET /customers — search/pagination/sort only. */
export const customersApi = {
  list: async (filters: PaginatedFilters): Promise<{ items: Customer[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<Customer[]>({ method: 'GET', url: '/customers', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<Customer> => {
    const { data } = await apiRequest<Customer>({ method: 'GET', url: `/customers/${id}` });
    return data;
  },
  create: async (input: CreateCustomerInput): Promise<Customer> => {
    const { data } = await apiRequest<Customer>({ method: 'POST', url: '/customers', data: input });
    return data;
  },
  update: async (id: string, input: UpdateCustomerInput): Promise<Customer> => {
    const { data } = await apiRequest<Customer>({ method: 'PATCH', url: `/customers/${id}`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/customers/${id}` });
  },
  checkDuplicates: async (input: CheckDuplicatesInput): Promise<DuplicateCandidate[]> => {
    const { data } = await apiRequest<DuplicateCandidate[]>({ method: 'POST', url: '/customers/check-duplicates', data: input });
    return data;
  },
};
