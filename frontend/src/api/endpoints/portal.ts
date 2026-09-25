import { apiRequest } from '../client';
import type { PortalQuotation, PortalQuotationDetail, PortalInvoice, PortalInvoiceDetail, PortalProject } from '../../types/entities/portal';
import type { CustomerStatement } from '../../types/entities/finance';

/** Confirmed 1:1 against backend/src/modules/portal/portal.controller.ts. */
export const portalApi = {
  listQuotations: async (): Promise<PortalQuotation[]> => {
    const { data } = await apiRequest<PortalQuotation[]>({ method: 'GET', url: '/portal/quotations' });
    return data;
  },
  getQuotation: async (id: string): Promise<PortalQuotationDetail> => {
    const { data } = await apiRequest<PortalQuotationDetail>({ method: 'GET', url: `/portal/quotations/${id}` });
    return data;
  },
  listInvoices: async (): Promise<PortalInvoice[]> => {
    const { data } = await apiRequest<PortalInvoice[]>({ method: 'GET', url: '/portal/invoices' });
    return data;
  },
  getInvoice: async (id: string): Promise<PortalInvoiceDetail> => {
    const { data } = await apiRequest<PortalInvoiceDetail>({ method: 'GET', url: `/portal/invoices/${id}` });
    return data;
  },
  listProjects: async (): Promise<PortalProject[]> => {
    const { data } = await apiRequest<PortalProject[]>({ method: 'GET', url: '/portal/projects' });
    return data;
  },
  getStatement: async (fromDate: string, toDate: string): Promise<CustomerStatement> => {
    const { data } = await apiRequest<CustomerStatement>({ method: 'GET', url: '/portal/statement', params: { fromDate, toDate } });
    return data;
  },
};
