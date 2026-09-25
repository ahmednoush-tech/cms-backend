export interface LeaveType {
  id: string;
  name: string;
  requiresBalance: boolean;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeaveTypeInput {
  name: string;
  requiresBalance?: boolean;
  isPaid?: boolean;
}

export interface UpdateLeaveTypeInput {
  name?: string;
  isPaid?: boolean;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allocatedDays: string;
  usedDays: string;
  leaveType?: LeaveType;
}

export interface SetLeaveBalanceInput {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allocatedDays: number;
}

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysRequested: string;
  reason: string | null;
  status: LeaveRequestStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  leaveType?: LeaveType;
  employee?: { id: string; firstName: string; lastName: string };
}

export interface CreateLeaveRequestInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface RejectLeaveRequestInput {
  rejectionReason: string;
}

export interface LeaveRequestFilters {
  employeeId?: string;
  status?: LeaveRequestStatus;
}
