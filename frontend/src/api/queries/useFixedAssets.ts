import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fixedAssetsApi, depreciationRunsApi } from '../endpoints/fixedAssets';
import type {
  CreateFixedAssetInput,
  UpdateFixedAssetInput,
  FixedAssetFilters,
  CreateDepreciationRunInput,
  DisposeFixedAssetInput,
} from '../../types/entities/fixedAsset';

export function useFixedAssets(filters: FixedAssetFilters) {
  return useQuery({ queryKey: ['fixedAssets', 'list', filters], queryFn: () => fixedAssetsApi.list(filters) });
}

export function useFixedAsset(id: string | undefined) {
  return useQuery({
    queryKey: ['fixedAssets', 'detail', id],
    queryFn: () => fixedAssetsApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateFixedAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFixedAssetInput) => fixedAssetsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fixedAssets', 'list'] }),
  });
}

export function useUpdateFixedAsset(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateFixedAssetInput) => fixedAssetsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', 'list'] });
    },
  });
}

export function useDisposeFixedAsset(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DisposeFixedAssetInput) => fixedAssetsApi.dispose(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', 'list'] });
    },
  });
}

export function useDepreciationRuns() {
  return useQuery({ queryKey: ['depreciationRuns', 'list'], queryFn: () => depreciationRunsApi.list() });
}

export function useDepreciationRun(id: string | undefined) {
  return useQuery({
    queryKey: ['depreciationRuns', 'detail', id],
    queryFn: () => depreciationRunsApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateDepreciationRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDepreciationRunInput) => depreciationRunsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depreciationRuns', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', 'list'] });
    },
  });
}
