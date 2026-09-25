import { apiRequest } from '../client';
import type { PaginatedFilters, PaginationMeta } from '../../types/api';
import type {
  Lead,
  CreateLeadInput,
  UpdateLeadInput,
  UpdateLeadStatusInput,
  ConvertLeadInput,
} from '../../types/entities/lead';

/** Confirmed 1:1 against backend/src/modules/leads/leads.controller.ts. No status filter on GET /leads — search/pagination/sort only. */
export const leadsApi = {
  list: async (filters: PaginatedFilters): Promise<{ items: Lead[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<Lead[]>({ method: 'GET', url: '/leads', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<Lead> => {
    const { data } = await apiRequest<Lead>({ method: 'GET', url: `/leads/${id}` });
    return data;
  },
  create: async (input: CreateLeadInput): Promise<Lead> => {
    const { data } = await apiRequest<Lead>({ method: 'POST', url: '/leads', data: input });
    return data;
  },
  update: async (id: string, input: UpdateLeadInput): Promise<Lead> => {
    const { data } = await apiRequest<Lead>({ method: 'PATCH', url: `/leads/${id}`, data: input });
    return data;
  },
  updateStatus: async (id: string, input: UpdateLeadStatusInput): Promise<Lead> => {
    const { data } = await apiRequest<Lead>({ method: 'PATCH', url: `/leads/${id}/status`, data: input });
    return data;
  },
  /** Requires CRM:leads:edit AND CRM:customers:create simultaneously (confirmed, leads.controller.ts). */
  convert: async (id: string, input: ConvertLeadInput): Promise<unknown> => {
    const { data } = await apiRequest<unknown>({ method: 'POST', url: `/leads/${id}/convert`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/leads/${id}` });
  },
};
