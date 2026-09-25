import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalWorkflowsApi, approvalRequestsApi } from '../endpoints/approvals';
import type { CreateApprovalWorkflowInput, UpdateApprovalWorkflowInput, CreateApprovalRequestInput, ApprovalActionInput } from '../../types/entities/approval';

export function useApprovalWorkflows() {
  return useQuery({ queryKey: ['approvalWorkflows'], queryFn: () => approvalWorkflowsApi.list() });
}

export function useApprovalWorkflow(id: string | undefined) {
  return useQuery({
    queryKey: ['approvalWorkflows', 'detail', id],
    queryFn: () => approvalWorkflowsApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateApprovalWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApprovalWorkflowInput) => approvalWorkflowsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvalWorkflows'] }),
  });
}

export function useUpdateApprovalWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateApprovalWorkflowInput }) => approvalWorkflowsApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvalWorkflows'] }),
  });
}

export function useApprovalRequests() {
  return useQuery({ queryKey: ['approvalRequests', 'all'], queryFn: () => approvalRequestsApi.list() });
}

export function usePendingApprovalsForMe() {
  return useQuery({ queryKey: ['approvalRequests', 'pendingForMe'], queryFn: () => approvalRequestsApi.pendingForMe() });
}

export function useApprovalRequest(id: string | undefined) {
  return useQuery({
    queryKey: ['approvalRequests', 'detail', id],
    queryFn: () => approvalRequestsApi.get(id!),
    enabled: !!id,
  });
}

function invalidateApprovalRequestLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
}

export function useCreateApprovalRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApprovalRequestInput) => approvalRequestsApi.create(input),
    onSuccess: () => invalidateApprovalRequestLists(queryClient),
  });
}

export function useApproveApprovalRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ApprovalActionInput }) => approvalRequestsApi.approve(id, input),
    onSuccess: () => invalidateApprovalRequestLists(queryClient),
  });
}

export function useRejectApprovalRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ApprovalActionInput }) => approvalRequestsApi.reject(id, input),
    onSuccess: () => invalidateApprovalRequestLists(queryClient),
  });
}

export function useCancelApprovalRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approvalRequestsApi.cancel(id),
    onSuccess: () => invalidateApprovalRequestLists(queryClient),
  });
}
