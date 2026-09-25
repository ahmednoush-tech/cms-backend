import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsMetadataApi, reportDefinitionsApi } from '../endpoints/reports';
import type { CreateReportDefinitionInput, UpdateReportDefinitionInput } from '../../types/entities/report';

export function useReportsMetadata() {
  return useQuery({ queryKey: ['reportsMetadata'], queryFn: () => reportsMetadataApi.get(), staleTime: 10 * 60 * 1000 });
}

export function useReportDefinitions() {
  return useQuery({ queryKey: ['reportDefinitions'], queryFn: () => reportDefinitionsApi.list() });
}

export function useReportDefinition(id: string | undefined) {
  return useQuery({
    queryKey: ['reportDefinitions', 'detail', id],
    queryFn: () => reportDefinitionsApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateReportDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReportDefinitionInput) => reportDefinitionsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reportDefinitions'] }),
  });
}

export function useUpdateReportDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReportDefinitionInput }) => reportDefinitionsApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reportDefinitions'] }),
  });
}

export function useDeleteReportDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reportDefinitionsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reportDefinitions'] }),
  });
}

export function useRunReportDefinition(id: string | undefined) {
  return useQuery({
    queryKey: ['reportDefinitions', 'run', id],
    queryFn: () => reportDefinitionsApi.run(id!),
    enabled: !!id,
  });
}

/** No caching — a preview reflects the CURRENT in-progress form state, called on-demand, never background-refetched. */
export function usePreviewReport() {
  return useMutation({ mutationFn: (input: CreateReportDefinitionInput) => reportDefinitionsApi.preview(input) });
}
