import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../endpoints/leads';
import type { PaginatedFilters } from '../../types/api';
import type { CreateLeadInput, UpdateLeadInput, UpdateLeadStatusInput, ConvertLeadInput } from '../../types/entities/lead';

export function useLeads(filters: PaginatedFilters) {
  return useQuery({ queryKey: ['leads', 'list', filters], queryFn: () => leadsApi.list(filters) });
}

export function useLead(id: string | undefined) {
  return useQuery({ queryKey: ['leads', 'detail', id], queryFn: () => leadsApi.get(id!), enabled: !!id });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeadInput) => leadsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads', 'list'] }),
  });
}

export function useUpdateLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLeadInput) => leadsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['leads', 'list'] });
    },
  });
}

export function useUpdateLeadStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLeadStatusInput) => leadsApi.updateStatus(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['leads', 'list'] });
    },
  });
}

export function useConvertLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConvertLeadInput) => leadsApi.convert(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['leads', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'list'] });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leadsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads', 'list'] }),
  });
}
