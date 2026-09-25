import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recurringInvoiceTemplatesApi } from '../endpoints/recurringInvoiceTemplates';
import type { CreateRecurringInvoiceTemplateInput, UpdateRecurringInvoiceTemplateInput } from '../../types/entities/recurringInvoice';

export function useRecurringInvoiceTemplates() {
  return useQuery({ queryKey: ['recurringInvoiceTemplates', 'list'], queryFn: () => recurringInvoiceTemplatesApi.list() });
}

export function useRecurringInvoiceTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['recurringInvoiceTemplates', 'detail', id],
    queryFn: () => recurringInvoiceTemplatesApi.get(id!),
    enabled: !!id,
  });
}

function invalidateTemplate(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['recurringInvoiceTemplates', 'detail', id] });
  queryClient.invalidateQueries({ queryKey: ['recurringInvoiceTemplates', 'list'] });
}

export function useCreateRecurringInvoiceTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRecurringInvoiceTemplateInput) => recurringInvoiceTemplatesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurringInvoiceTemplates', 'list'] }),
  });
}

export function useUpdateRecurringInvoiceTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateRecurringInvoiceTemplateInput) => recurringInvoiceTemplatesApi.update(id, input),
    onSuccess: () => invalidateTemplate(queryClient, id),
  });
}

export function usePauseRecurringInvoiceTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => recurringInvoiceTemplatesApi.pause(id),
    onSuccess: () => invalidateTemplate(queryClient, id),
  });
}

export function useResumeRecurringInvoiceTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => recurringInvoiceTemplatesApi.resume(id),
    onSuccess: () => invalidateTemplate(queryClient, id),
  });
}

export function useCancelRecurringInvoiceTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => recurringInvoiceTemplatesApi.cancel(id),
    onSuccess: () => invalidateTemplate(queryClient, id),
  });
}

export function useGenerateDueInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => recurringInvoiceTemplatesApi.generateDue(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringInvoiceTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', 'list'] });
    },
  });
}
