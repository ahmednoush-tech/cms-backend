import { apiRequest } from '../client';
import type { PaginationMeta } from '../../types/api';
import type {
  FixedAsset,
  CreateFixedAssetInput,
  UpdateFixedAssetInput,
  FixedAssetFilters,
  DepreciationRun,
  CreateDepreciationRunInput,
  DisposeFixedAssetInput,
} from '../../types/entities/fixedAsset';

/** Confirmed 1:1 against backend/src/modules/fixed-assets/fixed-assets.controller.ts and depreciation-runs.controller.ts. */
export const fixedAssetsApi = {
  list: async (filters: FixedAssetFilters): Promise<{ items: FixedAsset[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<FixedAsset[]>({ method: 'GET', url: '/fixed-assets', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<FixedAsset> => {
    const { data } = await apiRequest<FixedAsset>({ method: 'GET', url: `/fixed-assets/${id}` });
    return data;
  },
  create: async (input: CreateFixedAssetInput): Promise<FixedAsset> => {
    const { data } = await apiRequest<FixedAsset>({ method: 'POST', url: '/fixed-assets', data: input });
    return data;
  },
  update: async (id: string, input: UpdateFixedAssetInput): Promise<FixedAsset> => {
    const { data } = await apiRequest<FixedAsset>({ method: 'PATCH', url: `/fixed-assets/${id}`, data: input });
    return data;
  },
  dispose: async (id: string, input: DisposeFixedAssetInput): Promise<FixedAsset> => {
    const { data } = await apiRequest<FixedAsset>({ method: 'POST', url: `/fixed-assets/${id}/dispose`, data: input });
    return data;
  },
};

export const depreciationRunsApi = {
  list: async (): Promise<DepreciationRun[]> => {
    const { data } = await apiRequest<DepreciationRun[]>({ method: 'GET', url: '/depreciation-runs' });
    return data;
  },
  get: async (id: string): Promise<DepreciationRun> => {
    const { data } = await apiRequest<DepreciationRun>({ method: 'GET', url: `/depreciation-runs/${id}` });
    return data;
  },
  create: async (input: CreateDepreciationRunInput): Promise<DepreciationRun> => {
    const { data } = await apiRequest<DepreciationRun>({ method: 'POST', url: '/depreciation-runs', data: input });
    return data;
  },
};
