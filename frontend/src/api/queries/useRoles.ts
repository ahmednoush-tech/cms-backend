import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rolesApi, permissionsApi } from '../endpoints/roles';
import type { CreateRoleInput, AssignPermissionsInput, AssignRoleInput } from '../../types/entities/administration';

export function useRoles() {
  return useQuery({ queryKey: ['roles', 'list'], queryFn: () => rolesApi.list() });
}

export function useRole(id: string | undefined) {
  return useQuery({ queryKey: ['roles', 'detail', id], queryFn: () => rolesApi.get(id!), enabled: !!id });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoleInput) => rolesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles', 'list'] }),
  });
}

export function useAssignPermissions(roleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignPermissionsInput) => rolesApi.assignPermissions(roleId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', 'detail', roleId] });
      queryClient.invalidateQueries({ queryKey: ['roles', 'list'] });
    },
  });
}

export function useAssignRoleToUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignRoleInput) => rolesApi.assignToUser(input),
    // See useRemoveRoleFromUser's comment — same two-sided cache.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
  });
}

export function useRemoveRoleFromUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId, scopeId }: { userId: string; roleId: string; scopeId?: string }) => rolesApi.removeFromUser(userId, roleId, scopeId),
    // Invalidates both sides — this removal is shown from a
    // role's "assigned users" list AND from a user's "current
    // roles" list, and each keeps its own query cache.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
  });
}

/** Global reference data — permissions aren't company-scoped, so no filters/pagination needed. */
export function usePermissionsList() {
  return useQuery({ queryKey: ['permissions', 'list'], queryFn: () => permissionsApi.list(), staleTime: 5 * 60_000 });
}
