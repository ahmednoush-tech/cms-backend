import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../endpoints/customers';
import type { CheckDuplicatesInput } from '../../types/entities/duplicateCandidate';
import { customerContactsApi, customerUsersApi } from '../endpoints/customerSubResources';
import type { PaginatedFilters } from '../../types/api';
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateCustomerContactInput,
  UpdateCustomerContactInput,
  CreatePortalUserInput,
  LinkExistingUserInput,
} from '../../types/entities/customer';

export function useCustomers(filters: PaginatedFilters) {
  return useQuery({ queryKey: ['customers', 'list', filters], queryFn: () => customersApi.list(filters) });
}

export function useCustomer(id: string | undefined) {
  return useQuery({ queryKey: ['customers', 'detail', id], queryFn: () => customersApi.get(id!), enabled: !!id });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCustomerInput) => customersApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', 'list'] }),
  });
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCustomerInput) => customersApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'list'] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', 'list'] }),
  });
}

// ---- Contacts (nested) ----

export function useCustomerContacts(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customers', customerId, 'contacts'],
    queryFn: () => customerContactsApi.list(customerId!),
    enabled: !!customerId,
  });
}

export function useCreateCustomerContact(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCustomerContactInput) => customerContactsApi.create(customerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'contacts'] }),
  });
}

export function useUpdateCustomerContact(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, input }: { contactId: string; input: UpdateCustomerContactInput }) =>
      customerContactsApi.update(customerId, contactId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'contacts'] }),
  });
}

export function useDeleteCustomerContact(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => customerContactsApi.remove(customerId, contactId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'contacts'] }),
  });
}

// ---- Portal users (nested) ----

export function useCustomerPortalUsers(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customers', customerId, 'portal-users'],
    queryFn: () => customerUsersApi.list(customerId!),
    enabled: !!customerId,
  });
}

export function useCreatePortalUser(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePortalUserInput) => customerUsersApi.create(customerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'portal-users'] }),
  });
}

export function useLinkExistingPortalUser(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkExistingUserInput) => customerUsersApi.linkExisting(customerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'portal-users'] }),
  });
}

export function useRevokePortalUser(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (customerUserId: string) => customerUsersApi.revoke(customerId, customerUserId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'portal-users'] }),
  });
}

/** No caching (queryKey-based) — this is deliberately a mutation, called on-demand right before a create/update submission, never a background-refetched query. */
export function useCheckCustomerDuplicates() {
  return useMutation({ mutationFn: (input: CheckDuplicatesInput) => customersApi.checkDuplicates(input) });
}
