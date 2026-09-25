import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { opportunitiesApi } from '../endpoints/opportunities';
import type {
  OpportunityFilters,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  UpdateOpportunityStageInput,
} from '../../types/entities/opportunity';

export function useOpportunities(filters: OpportunityFilters) {
  return useQuery({ queryKey: ['opportunities', 'list', filters], queryFn: () => opportunitiesApi.list(filters) });
}

export function useOpportunity(id: string | undefined) {
  return useQuery({
    queryKey: ['opportunities', 'detail', id],
    queryFn: () => opportunitiesApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOpportunityInput) => opportunitiesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opportunities', 'list'] }),
  });
}

export function useUpdateOpportunity(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOpportunityInput) => opportunitiesApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['opportunities', 'list'] });
    },
  });
}

export function useUpdateOpportunityStage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOpportunityStageInput) => opportunitiesApi.updateStage(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['opportunities', 'list'] });
    },
  });
}

export function useDeleteOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => opportunitiesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opportunities', 'list'] }),
  });
}
