import { useQuery } from '@tanstack/react-query';
import { portalApi } from '../endpoints/portal';

export function usePortalQuotations() {
  return useQuery({ queryKey: ['portal', 'quotations', 'list'], queryFn: () => portalApi.listQuotations() });
}

export function usePortalQuotation(id: string | undefined) {
  return useQuery({
    queryKey: ['portal', 'quotations', 'detail', id],
    queryFn: () => portalApi.getQuotation(id!),
    enabled: !!id,
  });
}

export function usePortalInvoices() {
  return useQuery({ queryKey: ['portal', 'invoices', 'list'], queryFn: () => portalApi.listInvoices() });
}

export function usePortalInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['portal', 'invoices', 'detail', id],
    queryFn: () => portalApi.getInvoice(id!),
    enabled: !!id,
  });
}

export function usePortalProjects() {
  return useQuery({ queryKey: ['portal', 'projects', 'list'], queryFn: () => portalApi.listProjects() });
}

export function usePortalStatement(fromDate: string | null, toDate: string | null) {
  return useQuery({
    queryKey: ['portal', 'statement', fromDate, toDate],
    queryFn: () => portalApi.getStatement(fromDate!, toDate!),
    enabled: !!fromDate && !!toDate,
  });
}
