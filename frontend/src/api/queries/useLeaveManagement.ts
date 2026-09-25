import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveTypesApi, leaveBalancesApi, leaveRequestsApi } from '../endpoints/leave';
import type {
  CreateLeaveTypeInput,
  UpdateLeaveTypeInput,
  SetLeaveBalanceInput,
  CreateLeaveRequestInput,
  RejectLeaveRequestInput,
  LeaveRequestFilters,
} from '../../types/entities/leave';

export function useLeaveTypes() {
  return useQuery({ queryKey: ['leaveTypes'], queryFn: () => leaveTypesApi.list() });
}

export function useCreateLeaveType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeaveTypeInput) => leaveTypesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaveTypes'] }),
  });
}

export function useUpdateLeaveType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLeaveTypeInput }) => leaveTypesApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaveTypes'] }),
  });
}

export function useDeactivateLeaveType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leaveTypesApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaveTypes'] }),
  });
}

export function useLeaveBalances(employeeId: string | undefined, year: number) {
  return useQuery({
    queryKey: ['leaveBalances', employeeId, year],
    queryFn: () => leaveBalancesApi.listForEmployee(employeeId!, year),
    enabled: !!employeeId,
  });
}

export function useSetLeaveBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetLeaveBalanceInput) => leaveBalancesApi.setAllocation(input),
    onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: ['leaveBalances', variables.employeeId, variables.year] }),
  });
}

export function useLeaveRequests(filters: LeaveRequestFilters) {
  return useQuery({ queryKey: ['leaveRequests', filters], queryFn: () => leaveRequestsApi.list(filters) });
}

export function useLeaveRequest(id: string | undefined) {
  return useQuery({ queryKey: ['leaveRequests', 'detail', id], queryFn: () => leaveRequestsApi.get(id!), enabled: !!id });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, input }: { employeeId: string; input: CreateLeaveRequestInput }) => leaveRequestsApi.create(employeeId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaveRequests'] }),
  });
}

export function useApproveLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leaveRequestsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
    },
  });
}

export function useRejectLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RejectLeaveRequestInput }) => leaveRequestsApi.reject(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaveRequests'] }),
  });
}

export function useCancelLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, id }: { employeeId: string; id: string }) => leaveRequestsApi.cancel(employeeId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaveRequests'] }),
  });
}
