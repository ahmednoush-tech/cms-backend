import { apiRequest } from '../client';
import type {
  RecurringInvoiceTemplate,
  CreateRecurringInvoiceTemplateInput,
  UpdateRecurringInvoiceTemplateInput,
  GenerateDueResult,
} from '../../types/entities/recurringInvoice';

/** Confirmed 1:1 against backend/src/modules/finance/recurring-invoice-templates.controller.ts. */
export const recurringInvoiceTemplatesApi = {
  list: async (): Promise<RecurringInvoiceTemplate[]> => {
    const { data } = await apiRequest<RecurringInvoiceTemplate[]>({ method: 'GET', url: '/recurring-invoice-templates' });
    return data;
  },
  get: async (id: string): Promise<RecurringInvoiceTemplate> => {
    const { data } = await apiRequest<RecurringInvoiceTemplate>({ method: 'GET', url: `/recurring-invoice-templates/${id}` });
    return data;
  },
  create: async (input: CreateRecurringInvoiceTemplateInput): Promise<RecurringInvoiceTemplate> => {
    const { data } = await apiRequest<RecurringInvoiceTemplate>({ method: 'POST', url: '/recurring-invoice-templates', data: input });
    return data;
  },
  update: async (id: string, input: UpdateRecurringInvoiceTemplateInput): Promise<RecurringInvoiceTemplate> => {
    const { data } = await apiRequest<RecurringInvoiceTemplate>({ method: 'PATCH', url: `/recurring-invoice-templates/${id}`, data: input });
    return data;
  },
  pause: async (id: string): Promise<RecurringInvoiceTemplate> => {
    const { data } = await apiRequest<RecurringInvoiceTemplate>({ method: 'POST', url: `/recurring-invoice-templates/${id}/pause` });
    return data;
  },
  resume: async (id: string): Promise<RecurringInvoiceTemplate> => {
    const { data } = await apiRequest<RecurringInvoiceTemplate>({ method: 'POST', url: `/recurring-invoice-templates/${id}/resume` });
    return data;
  },
  cancel: async (id: string): Promise<RecurringInvoiceTemplate> => {
    const { data } = await apiRequest<RecurringInvoiceTemplate>({ method: 'POST', url: `/recurring-invoice-templates/${id}/cancel` });
    return data;
  },
  generateDue: async (): Promise<GenerateDueResult> => {
    const { data } = await apiRequest<GenerateDueResult>({ method: 'POST', url: '/recurring-invoice-templates/generate-due' });
    return data;
  },
};
