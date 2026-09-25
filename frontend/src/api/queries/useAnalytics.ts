import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../endpoints/analytics';

export function useRevenueTrend(months?: number) {
  return useQuery({ queryKey: ['analytics', 'revenueTrend', months], queryFn: () => analyticsApi.getRevenueTrend(months) });
}

export function useSalesFunnel(fromDate: string | null, toDate: string | null) {
  return useQuery({
    queryKey: ['analytics', 'salesFunnel', fromDate, toDate],
    queryFn: () => analyticsApi.getSalesFunnel(fromDate!, toDate!),
    enabled: !!fromDate && !!toDate,
  });
}

export function useTopCustomers(fromDate: string | null, toDate: string | null, limit?: number) {
  return useQuery({
    queryKey: ['analytics', 'topCustomers', fromDate, toDate, limit],
    queryFn: () => analyticsApi.getTopCustomers(fromDate!, toDate!, limit),
    enabled: !!fromDate && !!toDate,
  });
}

export function useEmployeeUtilization(fromDate: string | null, toDate: string | null) {
  return useQuery({
    queryKey: ['analytics', 'employeeUtilization', fromDate, toDate],
    queryFn: () => analyticsApi.getEmployeeUtilization(fromDate!, toDate!),
    enabled: !!fromDate && !!toDate,
  });
}

export function useSalesForecast() {
  return useQuery({ queryKey: ['analytics', 'salesForecast'], queryFn: () => analyticsApi.getSalesForecast() });
}
