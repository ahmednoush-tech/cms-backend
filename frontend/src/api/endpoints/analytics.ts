import { apiRequest } from '../client';
import type { RevenueTrendPoint, SalesFunnel, TopCustomer, EmployeeUtilization, SalesForecast } from '../../types/entities/analytics';

/** Confirmed 1:1 against backend/src/modules/analytics/analytics.controller.ts. */
export const analyticsApi = {
  getRevenueTrend: async (months?: number): Promise<RevenueTrendPoint[]> => {
    const { data } = await apiRequest<RevenueTrendPoint[]>({ method: 'GET', url: '/analytics/revenue-trend', params: { months } });
    return data;
  },
  getSalesFunnel: async (fromDate: string, toDate: string): Promise<SalesFunnel> => {
    const { data } = await apiRequest<SalesFunnel>({ method: 'GET', url: '/analytics/sales-funnel', params: { fromDate, toDate } });
    return data;
  },
  getTopCustomers: async (fromDate: string, toDate: string, limit?: number): Promise<TopCustomer[]> => {
    const { data } = await apiRequest<TopCustomer[]>({ method: 'GET', url: '/analytics/top-customers', params: { fromDate, toDate, limit } });
    return data;
  },
  getEmployeeUtilization: async (fromDate: string, toDate: string): Promise<EmployeeUtilization[]> => {
    const { data } = await apiRequest<EmployeeUtilization[]>({ method: 'GET', url: '/analytics/employee-utilization', params: { fromDate, toDate } });
    return data;
  },
  getSalesForecast: async (): Promise<SalesForecast> => {
    const { data } = await apiRequest<SalesForecast>({ method: 'GET', url: '/analytics/sales-forecast' });
    return data;
  },
};
