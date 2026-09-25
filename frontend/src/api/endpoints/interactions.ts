import { apiRequest } from '../client';
import type { Interaction, CreateInteractionInput, UpdateInteractionInput } from '../../types/entities/interaction';

/** Confirmed 1:1 against backend/src/modules/interactions/interactions.controller.ts. */
export const interactionsApi = {
  create: async (input: CreateInteractionInput): Promise<Interaction> => {
    const { data } = await apiRequest<Interaction>({ method: 'POST', url: '/interactions', data: input });
    return data;
  },
  get: async (id: string): Promise<Interaction> => {
    const { data } = await apiRequest<Interaction>({ method: 'GET', url: `/interactions/${id}` });
    return data;
  },
  update: async (id: string, input: UpdateInteractionInput): Promise<Interaction> => {
    const { data } = await apiRequest<Interaction>({ method: 'PATCH', url: `/interactions/${id}`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/interactions/${id}` });
  },
  listForCustomer: async (customerId: string): Promise<Interaction[]> => {
    const { data } = await apiRequest<Interaction[]>({ method: 'GET', url: `/interactions/by-customer/${customerId}` });
    return data;
  },
  listForLead: async (leadId: string): Promise<Interaction[]> => {
    const { data } = await apiRequest<Interaction[]>({ method: 'GET', url: `/interactions/by-lead/${leadId}` });
    return data;
  },
  listForOpportunity: async (opportunityId: string): Promise<Interaction[]> => {
    const { data } = await apiRequest<Interaction[]>({ method: 'GET', url: `/interactions/by-opportunity/${opportunityId}` });
    return data;
  },
};
