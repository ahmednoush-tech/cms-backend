import { apiRequest } from '../client';
import type {
  DashboardFilters,
  DashboardOperationsResponse,
  DashboardSalesResponse,
  DashboardSummaryResponse,
  DashboardWorkloadResponse,
} from '../../types/dashboard';

/**
 * Confirmed 1:1 against backend/src/modules/dashboard/dashboard.controller.ts
 * this session — exactly these four routes exist. `filters` is
 * passed as-is as query params; axios serializes undefined values
 * as omitted, so an unset filter is simply not sent (never sent
 * as an empty string), matching what the backend's optional
 * class-validator fields expect.
 */
export const dashboardApi = {
  summary: async (filters: DashboardFilters): Promise<DashboardSummaryResponse> => {
    const { data } = await apiRequest<DashboardSummaryResponse>({
      method: 'GET',
      url: '/dashboard/summary',
      params: filters,
    });
    return data;
  },

  sales: async (filters: DashboardFilters): Promise<DashboardSalesResponse> => {
    const { data } = await apiRequest<DashboardSalesResponse>({
      method: 'GET',
      url: '/dashboard/sales',
      params: filters,
    });
    return data;
  },

  operations: async (filters: DashboardFilters): Promise<DashboardOperationsResponse> => {
    const { data } = await apiRequest<DashboardOperationsResponse>({
      method: 'GET',
      url: '/dashboard/operations',
      params: filters,
    });
    return data;
  },

  workload: async (filters: DashboardFilters): Promise<DashboardWorkloadResponse> => {
    const { data } = await apiRequest<DashboardWorkloadResponse>({
      method: 'GET',
      url: '/dashboard/workload',
      params: filters,
    });
    return data;
  },
};
