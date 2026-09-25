import { apiRequest } from '../client';
import type { PublicQuotation } from '../../types/entities/publicQuotation';

/** Confirmed 1:1 against backend/src/modules/quotations/public-quotation.controller.ts — the ONE unauthenticated endpoint in the backend. */
export const publicQuotationApi = {
  getByToken: async (token: string): Promise<PublicQuotation> => {
    const { data } = await apiRequest<PublicQuotation>({ method: 'GET', url: `/public/quotations/${token}` });
    return data;
  },
};
