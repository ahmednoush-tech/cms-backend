import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../endpoints/employees';
import type { PaginatedFilters } from '../../types/api';
import type { CreateEmployeeInput, UpdateEmployeeInput } from '../../types/entities/administration';

export function useEmployees(filters: PaginatedFilters & { departmentId?: string }) {
  return useQuery({ queryKey: ['employees', 'list', filters], queryFn: () => employeesApi.list(filters) });
}

export function useEmployee(id: string | undefined) {
  return useQuery({ queryKey: ['employees', 'detail', id], queryFn: () => employeesApi.get(id!), enabled: !!id });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => employeesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', 'list'] }),
  });
}

function invalidateEmployee(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['employees', 'detail', id] });
  queryClient.invalidateQueries({ queryKey: ['employees', 'list'] });
}

export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEmployeeInput) => employeesApi.update(id, input),
    onSuccess: () => invalidateEmployee(queryClient, id),
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employeesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', 'list'] }),
  });
}

export function useLinkEmployeeUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => employeesApi.linkUser(id, userId),
    onSuccess: () => invalidateEmployee(queryClient, id),
  });
}

export function useCheckExpiringIqamas() {
  return useMutation({ mutationFn: (daysThreshold?: number) => employeesApi.checkExpiringIqamas(daysThreshold) });
}
