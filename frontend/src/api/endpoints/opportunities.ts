import { apiRequest } from '../client';
import type { PaginationMeta } from '../../types/api';
import type {
  Opportunity,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  UpdateOpportunityStageInput,
  OpportunityFilters,
} from '../../types/entities/opportunity';

/** Confirmed 1:1 against backend/src/modules/opportunities/opportunities.controller.ts. */
export const opportunitiesApi = {
  list: async (filters: OpportunityFilters): Promise<{ items: Opportunity[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<Opportunity[]>({ method: 'GET', url: '/opportunities', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<Opportunity> => {
    const { data } = await apiRequest<Opportunity>({ method: 'GET', url: `/opportunities/${id}` });
    return data;
  },
  create: async (input: CreateOpportunityInput): Promise<Opportunity> => {
    const { data } = await apiRequest<Opportunity>({ method: 'POST', url: '/opportunities', data: input });
    return data;
  },
  update: async (id: string, input: UpdateOpportunityInput): Promise<Opportunity> => {
    const { data } = await apiRequest<Opportunity>({ method: 'PATCH', url: `/opportunities/${id}`, data: input });
    return data;
  },
  updateStage: async (id: string, input: UpdateOpportunityStageInput): Promise<Opportunity> => {
    const { data } = await apiRequest<Opportunity>({ method: 'PATCH', url: `/opportunities/${id}/stage`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/opportunities/${id}` });
  },
};
