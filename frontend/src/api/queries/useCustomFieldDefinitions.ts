import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customFieldDefinitionsApi } from '../endpoints/customFieldDefinitions';
import type { CustomFieldEntityType, CreateCustomFieldDefinitionInput, UpdateCustomFieldDefinitionInput } from '../../types/entities/customField';

export function useCustomFieldDefinitions(entityType: CustomFieldEntityType) {
  return useQuery({
    queryKey: ['customFieldDefinitions', entityType],
    queryFn: () => customFieldDefinitionsApi.list(entityType),
  });
}

/** Convenience wrapper: only the ACTIVE definitions, for rendering the actual dynamic form fields. */
export function useActiveCustomFieldDefinitions(entityType: CustomFieldEntityType) {
  const query = useCustomFieldDefinitions(entityType);
  return { ...query, data: query.data?.filter((d) => d.isActive) };
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, entityType: CustomFieldEntityType) {
  queryClient.invalidateQueries({ queryKey: ['customFieldDefinitions', entityType] });
}

export function useCreateCustomFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCustomFieldDefinitionInput) => customFieldDefinitionsApi.create(input),
    onSuccess: (result) => invalidate(queryClient, result.entityType),
  });
}

export function useUpdateCustomFieldDefinition(entityType: CustomFieldEntityType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCustomFieldDefinitionInput }) => customFieldDefinitionsApi.update(id, input),
    onSuccess: () => invalidate(queryClient, entityType),
  });
}

export function useDeactivateCustomFieldDefinition(entityType: CustomFieldEntityType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customFieldDefinitionsApi.deactivate(id),
    onSuccess: () => invalidate(queryClient, entityType),
  });
}
