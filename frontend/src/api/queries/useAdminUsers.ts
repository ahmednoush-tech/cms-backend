import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../endpoints/users';
import type { PaginatedFilters } from '../../types/api';
import type { CreateUserInput, UpdateUserInput, GrantPermissionInput } from '../../types/entities/administration';

/** `options.enabled: false` skips the request entirely — e.g. for a viewer who lacks Administration:users:view, where it would only 403. */
export function useAdminUsers(filters: PaginatedFilters, options?: { enabled?: boolean }) {
  return useQuery({ queryKey: ['adminUsers', 'list', filters], queryFn: () => usersApi.list(filters), enabled: options?.enabled ?? true });
}

export function useAdminUser(id: string | undefined) {
  return useQuery({ queryKey: ['adminUsers', 'detail', id], queryFn: () => usersApi.get(id!), enabled: !!id });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => usersApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminUsers', 'list'] }),
  });
}

export function useUpdateAdminUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserInput) => usersApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['adminUsers', 'list'] });
    },
  });
}

export function useSetUserPassword(id: string) {
  return useMutation({
    mutationFn: (newPassword: string) => usersApi.setPassword(id, newPassword),
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminUsers', 'list'] }),
  });
}

export function useGrantPermission(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GrantPermissionInput) => usersApi.grantPermission(userId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminUsers', 'detail', userId] }),
  });
}

export function useRevokePermission(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ permissionId, scopeId }: { permissionId: string; scopeId?: string }) =>
      usersApi.revokePermission(userId, permissionId, scopeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminUsers', 'detail', userId] }),
  });
}
