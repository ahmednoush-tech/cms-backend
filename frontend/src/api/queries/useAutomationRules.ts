import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { automationRulesApi } from '../endpoints/automationRules';
import type { CreateAutomationRuleInput, UpdateAutomationRuleInput } from '../../types/entities/automationRule';

export function useAutomationRules() {
  return useQuery({ queryKey: ['automationRules', 'list'], queryFn: () => automationRulesApi.list() });
}

export function useAutomationRule(id: string | undefined) {
  return useQuery({ queryKey: ['automationRules', 'detail', id], queryFn: () => automationRulesApi.get(id!), enabled: !!id });
}

export function useCreateAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAutomationRuleInput) => automationRulesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automationRules', 'list'] }),
  });
}

export function useUpdateAutomationRule(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAutomationRuleInput) => automationRulesApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automationRules', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['automationRules', 'detail', id] });
    },
  });
}

export function useDeleteAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => automationRulesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automationRules', 'list'] }),
  });
}
