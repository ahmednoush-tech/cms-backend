import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { interactionsApi } from '../endpoints/interactions';
import type { CreateInteractionInput, UpdateInteractionInput } from '../../types/entities/interaction';

export function useInteractionsForCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: ['interactions', 'byCustomer', customerId],
    queryFn: () => interactionsApi.listForCustomer(customerId!),
    enabled: !!customerId,
  });
}

export function useInteractionsForLead(leadId: string | undefined) {
  return useQuery({
    queryKey: ['interactions', 'byLead', leadId],
    queryFn: () => interactionsApi.listForLead(leadId!),
    enabled: !!leadId,
  });
}

export function useInteractionsForOpportunity(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ['interactions', 'byOpportunity', opportunityId],
    queryFn: () => interactionsApi.listForOpportunity(opportunityId!),
    enabled: !!opportunityId,
  });
}

type ParentRef = { kind: 'customer' | 'lead' | 'opportunity'; id: string };

function invalidateParent(queryClient: ReturnType<typeof useQueryClient>, parent: ParentRef) {
  const key = parent.kind === 'customer' ? 'byCustomer' : parent.kind === 'lead' ? 'byLead' : 'byOpportunity';
  queryClient.invalidateQueries({ queryKey: ['interactions', key, parent.id] });
}

export function useCreateInteraction(parent: ParentRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInteractionInput) => interactionsApi.create(input),
    onSuccess: () => invalidateParent(queryClient, parent),
  });
}

export function useUpdateInteraction(id: string, parent: ParentRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateInteractionInput) => interactionsApi.update(id, input),
    onSuccess: () => invalidateParent(queryClient, parent),
  });
}

export function useDeleteInteraction(parent: ParentRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => interactionsApi.remove(id),
    onSuccess: () => invalidateParent(queryClient, parent),
  });
}
