import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentsApi } from '../endpoints/departments';
import type { PaginatedFilters } from '../../types/api';
import type { CreateDepartmentInput, UpdateDepartmentInput } from '../../types/entities/administration';

export function useDepartments(filters: PaginatedFilters) {
  return useQuery({ queryKey: ['departments', 'list', filters], queryFn: () => departmentsApi.list(filters) });
}

export function useDepartment(id: string | undefined) {
  return useQuery({ queryKey: ['departments', 'detail', id], queryFn: () => departmentsApi.get(id!), enabled: !!id });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => departmentsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments', 'list'] }),
  });
}

export function useUpdateDepartment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDepartmentInput) => departmentsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['departments', 'list'] });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments', 'list'] }),
  });
}
