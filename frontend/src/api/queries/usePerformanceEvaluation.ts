import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { performanceCyclesApi, performanceCriteriaApi, performanceEvaluationsApi } from '../endpoints/performance';
import type {
  CreatePerformanceCycleInput,
  UpdatePerformanceCycleInput,
  CreatePerformanceCriterionInput,
  UpdatePerformanceCriterionInput,
  CreatePerformanceEvaluationInput,
  UpdatePerformanceEvaluationInput,
} from '../../types/entities/performance';

export function usePerformanceCycles() {
  return useQuery({ queryKey: ['performanceCycles'], queryFn: () => performanceCyclesApi.list() });
}

export function useCreatePerformanceCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePerformanceCycleInput) => performanceCyclesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['performanceCycles'] }),
  });
}

export function useUpdatePerformanceCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePerformanceCycleInput }) => performanceCyclesApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['performanceCycles'] }),
  });
}

export function usePerformanceCriteria() {
  return useQuery({ queryKey: ['performanceCriteria'], queryFn: () => performanceCriteriaApi.list() });
}

export function useCreatePerformanceCriterion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePerformanceCriterionInput) => performanceCriteriaApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['performanceCriteria'] }),
  });
}

export function useUpdatePerformanceCriterion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePerformanceCriterionInput }) => performanceCriteriaApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['performanceCriteria'] }),
  });
}

export function useDeactivatePerformanceCriterion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => performanceCriteriaApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['performanceCriteria'] }),
  });
}

export function usePerformanceEvaluationsForEmployee(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['performanceEvaluations', 'employee', employeeId],
    queryFn: () => performanceEvaluationsApi.listForEmployee(employeeId!),
    enabled: !!employeeId,
  });
}

export function usePerformanceEvaluationsForCycle(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['performanceEvaluations', 'cycle', cycleId],
    queryFn: () => performanceEvaluationsApi.listForCycle(cycleId!),
    enabled: !!cycleId,
  });
}

export function usePerformanceEvaluation(id: string | undefined) {
  return useQuery({
    queryKey: ['performanceEvaluations', 'detail', id],
    queryFn: () => performanceEvaluationsApi.get(id!),
    enabled: !!id,
  });
}

function invalidateEvaluationLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['performanceEvaluations'] });
}

export function useCreatePerformanceEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePerformanceEvaluationInput) => performanceEvaluationsApi.create(input),
    onSuccess: () => invalidateEvaluationLists(queryClient),
  });
}

export function useUpdatePerformanceEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePerformanceEvaluationInput }) => performanceEvaluationsApi.update(id, input),
    onSuccess: () => invalidateEvaluationLists(queryClient),
  });
}

export function useFinalizePerformanceEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => performanceEvaluationsApi.finalize(id),
    onSuccess: () => invalidateEvaluationLists(queryClient),
  });
}
