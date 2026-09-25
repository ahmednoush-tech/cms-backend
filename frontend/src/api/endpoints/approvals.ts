import { apiRequest } from '../client';
import type {
  ApprovalWorkflow,
  CreateApprovalWorkflowInput,
  UpdateApprovalWorkflowInput,
  ApprovalRequest,
  CreateApprovalRequestInput,
  ApprovalActionInput,
} from '../../types/entities/approval';

/** Confirmed 1:1 against backend/src/modules/approval-workflows/*.controller.ts. */
export const approvalWorkflowsApi = {
  list: async (): Promise<ApprovalWorkflow[]> => {
    const { data } = await apiRequest<ApprovalWorkflow[]>({ method: 'GET', url: '/approval-workflows' });
    return data;
  },
  get: async (id: string): Promise<ApprovalWorkflow> => {
    const { data } = await apiRequest<ApprovalWorkflow>({ method: 'GET', url: `/approval-workflows/${id}` });
    return data;
  },
  create: async (input: CreateApprovalWorkflowInput): Promise<ApprovalWorkflow> => {
    const { data } = await apiRequest<ApprovalWorkflow>({ method: 'POST', url: '/approval-workflows', data: input });
    return data;
  },
  update: async (id: string, input: UpdateApprovalWorkflowInput): Promise<ApprovalWorkflow> => {
    const { data } = await apiRequest<ApprovalWorkflow>({ method: 'PATCH', url: `/approval-workflows/${id}`, data: input });
    return data;
  },
};

export const approvalRequestsApi = {
  list: async (): Promise<ApprovalRequest[]> => {
    const { data } = await apiRequest<ApprovalRequest[]>({ method: 'GET', url: '/approval-requests' });
    return data;
  },
  pendingForMe: async (): Promise<ApprovalRequest[]> => {
    const { data } = await apiRequest<ApprovalRequest[]>({ method: 'GET', url: '/approval-requests/pending-for-me' });
    return data;
  },
  get: async (id: string): Promise<ApprovalRequest> => {
    const { data } = await apiRequest<ApprovalRequest>({ method: 'GET', url: `/approval-requests/${id}` });
    return data;
  },
  create: async (input: CreateApprovalRequestInput): Promise<ApprovalRequest> => {
    const { data } = await apiRequest<ApprovalRequest>({ method: 'POST', url: '/approval-requests', data: input });
    return data;
  },
  approve: async (id: string, input: ApprovalActionInput): Promise<ApprovalRequest> => {
    const { data } = await apiRequest<ApprovalRequest>({ method: 'PATCH', url: `/approval-requests/${id}/approve`, data: input });
    return data;
  },
  reject: async (id: string, input: ApprovalActionInput): Promise<ApprovalRequest> => {
    const { data } = await apiRequest<ApprovalRequest>({ method: 'PATCH', url: `/approval-requests/${id}/reject`, data: input });
    return data;
  },
  cancel: async (id: string): Promise<ApprovalRequest> => {
    const { data } = await apiRequest<ApprovalRequest>({ method: 'PATCH', url: `/approval-requests/${id}/cancel` });
    return data;
  },
};
