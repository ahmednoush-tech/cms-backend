import { apiRequest } from '../client';
import type {
  LeaveType,
  CreateLeaveTypeInput,
  UpdateLeaveTypeInput,
  LeaveBalance,
  SetLeaveBalanceInput,
  LeaveRequest,
  CreateLeaveRequestInput,
  RejectLeaveRequestInput,
  LeaveRequestFilters,
} from '../../types/entities/leave';

export const leaveTypesApi = {
  list: async (): Promise<LeaveType[]> => {
    const { data } = await apiRequest<LeaveType[]>({ method: 'GET', url: '/leave-types' });
    return data;
  },
  create: async (input: CreateLeaveTypeInput): Promise<LeaveType> => {
    const { data } = await apiRequest<LeaveType>({ method: 'POST', url: '/leave-types', data: input });
    return data;
  },
  update: async (id: string, input: UpdateLeaveTypeInput): Promise<LeaveType> => {
    const { data } = await apiRequest<LeaveType>({ method: 'PATCH', url: `/leave-types/${id}`, data: input });
    return data;
  },
  deactivate: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/leave-types/${id}` });
  },
};

export const leaveBalancesApi = {
  listForEmployee: async (employeeId: string, year: number): Promise<LeaveBalance[]> => {
    const { data } = await apiRequest<LeaveBalance[]>({ method: 'GET', url: `/leave-balances/employee/${employeeId}/year/${year}` });
    return data;
  },
  setAllocation: async (input: SetLeaveBalanceInput): Promise<LeaveBalance> => {
    const { data } = await apiRequest<LeaveBalance>({ method: 'POST', url: '/leave-balances', data: input });
    return data;
  },
};

export const leaveRequestsApi = {
  list: async (filters: LeaveRequestFilters): Promise<LeaveRequest[]> => {
    const { data } = await apiRequest<LeaveRequest[]>({ method: 'GET', url: '/leave-requests', params: filters });
    return data;
  },
  get: async (id: string): Promise<LeaveRequest> => {
    const { data } = await apiRequest<LeaveRequest>({ method: 'GET', url: `/leave-requests/${id}` });
    return data;
  },
  create: async (employeeId: string, input: CreateLeaveRequestInput): Promise<LeaveRequest> => {
    const { data } = await apiRequest<LeaveRequest>({ method: 'POST', url: `/leave-requests/employee/${employeeId}`, data: input });
    return data;
  },
  approve: async (id: string): Promise<LeaveRequest> => {
    const { data } = await apiRequest<LeaveRequest>({ method: 'PATCH', url: `/leave-requests/${id}/approve` });
    return data;
  },
  reject: async (id: string, input: RejectLeaveRequestInput): Promise<LeaveRequest> => {
    const { data } = await apiRequest<LeaveRequest>({ method: 'PATCH', url: `/leave-requests/${id}/reject`, data: input });
    return data;
  },
  cancel: async (employeeId: string, id: string): Promise<LeaveRequest> => {
    const { data } = await apiRequest<LeaveRequest>({ method: 'PATCH', url: `/leave-requests/employee/${employeeId}/${id}/cancel` });
    return data;
  },
};
