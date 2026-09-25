import { apiRequest } from '../client';
import type { PaginationMeta } from '../../types/api';
import type {
  Quotation,
  CreateQuotationInput,
  UpdateQuotationInput,
  QuotationFilters,
  QuotationItem,
  CreateQuotationItemInput,
  UpdateQuotationItemInput,
} from '../../types/entities/quotation';

/** Confirmed 1:1 against backend/src/modules/quotations/quotations.controller.ts. */
export const quotationsApi = {
  list: async (filters: QuotationFilters): Promise<{ items: Quotation[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<Quotation[]>({ method: 'GET', url: '/quotations', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<Quotation> => {
    const { data } = await apiRequest<Quotation>({ method: 'GET', url: `/quotations/${id}` });
    return data;
  },
  create: async (input: CreateQuotationInput): Promise<Quotation> => {
    const { data } = await apiRequest<Quotation>({ method: 'POST', url: '/quotations', data: input });
    return data;
  },
  update: async (id: string, input: UpdateQuotationInput): Promise<Quotation> => {
    const { data } = await apiRequest<Quotation>({ method: 'PATCH', url: `/quotations/${id}`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/quotations/${id}` });
  },
  // Lifecycle actions — each requires a distinct permission
  // (send/accept/reject/edit), confirmed against the controller.
  send: async (id: string): Promise<Quotation> => {
    const { data } = await apiRequest<Quotation>({ method: 'POST', url: `/quotations/${id}/send` });
    return data;
  },
  accept: async (id: string): Promise<Quotation> => {
    const { data } = await apiRequest<Quotation>({ method: 'POST', url: `/quotations/${id}/accept` });
    return data;
  },
  reject: async (id: string): Promise<Quotation> => {
    const { data } = await apiRequest<Quotation>({ method: 'POST', url: `/quotations/${id}/reject` });
    return data;
  },
  expire: async (id: string): Promise<Quotation> => {
    const { data } = await apiRequest<Quotation>({ method: 'POST', url: `/quotations/${id}/expire` });
    return data;
  },
};

/** Confirmed 1:1 against backend/src/modules/quotations/quotation-items.controller.ts — nested, mutable only while the quotation is 'draft' (422 otherwise). */
export const quotationItemsApi = {
  create: async (quotationId: string, input: CreateQuotationItemInput): Promise<QuotationItem> => {
    const { data } = await apiRequest<QuotationItem>({
      method: 'POST',
      url: `/quotations/${quotationId}/items`,
      data: input,
    });
    return data;
  },
  update: async (quotationId: string, itemId: string, input: UpdateQuotationItemInput): Promise<QuotationItem> => {
    const { data } = await apiRequest<QuotationItem>({
      method: 'PATCH',
      url: `/quotations/${quotationId}/items/${itemId}`,
      data: input,
    });
    return data;
  },
  remove: async (quotationId: string, itemId: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/quotations/${quotationId}/items/${itemId}` });
  },
};
