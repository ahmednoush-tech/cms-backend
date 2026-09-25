import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { quotationsApi, quotationItemsApi } from '../endpoints/quotations';
import type {
  QuotationFilters,
  CreateQuotationInput,
  UpdateQuotationInput,
  CreateQuotationItemInput,
  UpdateQuotationItemInput,
} from '../../types/entities/quotation';

export function useQuotations(filters: QuotationFilters) {
  return useQuery({ queryKey: ['quotations', 'list', filters], queryFn: () => quotationsApi.list(filters) });
}

export function useQuotation(id: string | undefined) {
  return useQuery({ queryKey: ['quotations', 'detail', id], queryFn: () => quotationsApi.get(id!), enabled: !!id });
}

export function useCreateQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuotationInput) => quotationsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotations', 'list'] }),
  });
}

export function useUpdateQuotation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateQuotationInput) => quotationsApi.update(id, input),
    onSuccess: () => invalidateQuotation(queryClient, id),
  });
}

export function useDeleteQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotationsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotations', 'list'] }),
  });
}

function invalidateQuotation(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['quotations', 'detail', id] });
  queryClient.invalidateQueries({ queryKey: ['quotations', 'list'] });
}

// ---- Lifecycle actions ----

export function useSendQuotation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => quotationsApi.send(id), onSuccess: () => invalidateQuotation(queryClient, id) });
}

export function useAcceptQuotation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => quotationsApi.accept(id), onSuccess: () => invalidateQuotation(queryClient, id) });
}

export function useRejectQuotation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => quotationsApi.reject(id), onSuccess: () => invalidateQuotation(queryClient, id) });
}

export function useExpireQuotation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => quotationsApi.expire(id), onSuccess: () => invalidateQuotation(queryClient, id) });
}

// ---- Items (nested, draft-only per backend rule) ----

export function useAddQuotationItem(quotationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuotationItemInput) => quotationItemsApi.create(quotationId, input),
    onSuccess: () => invalidateQuotation(queryClient, quotationId),
  });
}

export function useUpdateQuotationItem(quotationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateQuotationItemInput }) =>
      quotationItemsApi.update(quotationId, itemId, input),
    onSuccess: () => invalidateQuotation(queryClient, quotationId),
  });
}

export function useDeleteQuotationItem(quotationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => quotationItemsApi.remove(quotationId, itemId),
    onSuccess: () => invalidateQuotation(queryClient, quotationId),
  });
}
