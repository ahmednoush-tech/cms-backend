import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { payrollSettingsApi, payrollRunsApi } from '../endpoints/payroll';
import type { UpdatePayrollSettingsInput, CreatePayrollRunInput } from '../../types/entities/payroll';

export function usePayrollSettings() {
  return useQuery({ queryKey: ['payrollSettings'], queryFn: () => payrollSettingsApi.get() });
}

export function useUpdatePayrollSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePayrollSettingsInput) => payrollSettingsApi.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payrollSettings'] }),
  });
}

export function usePayrollRuns() {
  return useQuery({ queryKey: ['payrollRuns', 'list'], queryFn: () => payrollRunsApi.list() });
}

export function usePayrollRun(id: string | undefined) {
  return useQuery({
    queryKey: ['payrollRuns', 'detail', id],
    queryFn: () => payrollRunsApi.get(id!),
    enabled: !!id,
  });
}

function invalidatePayrollRun(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['payrollRuns', 'detail', id] });
  queryClient.invalidateQueries({ queryKey: ['payrollRuns', 'list'] });
}

export function useCreatePayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePayrollRunInput) => payrollRunsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payrollRuns', 'list'] }),
  });
}

export function useProcessPayrollRun(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => payrollRunsApi.process(id),
    onSuccess: () => invalidatePayrollRun(queryClient, id),
  });
}

export function usePayPayrollRun(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => payrollRunsApi.pay(id),
    onSuccess: () => invalidatePayrollRun(queryClient, id),
  });
}
