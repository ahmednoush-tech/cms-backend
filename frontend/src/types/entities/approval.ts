export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ApprovalWorkflowStep {
  id: string;
  workflowId: string;
  stepOrder: number;
  approverRoleId: string;
  approverRole?: { id: string; name: string };
}

export interface ApprovalWorkflow {
  id: string;
  companyId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  steps: ApprovalWorkflowStep[];
}

export interface CreateApprovalWorkflowInput {
  name: string;
  steps: { approverRoleId: string }[];
}

export interface UpdateApprovalWorkflowInput {
  name?: string;
  isActive?: boolean;
  steps?: { approverRoleId: string }[];
}

export interface ApprovalAction {
  id: string;
  requestId: string;
  stepOrder: number;
  actorId: string;
  actor?: { id: string; name: string };
  decision: 'approved' | 'rejected';
  comments: string | null;
  actionedAt: string;
}

export interface ApprovalRequest {
  id: string;
  companyId: string;
  workflowId: string;
  title: string;
  description: string | null;
  amount: string | null;
  requestedBy: string;
  requestedByUser?: { id: string; name: string };
  status: ApprovalRequestStatus;
  currentStepOrder: number;
  createdAt: string;
  updatedAt: string;
  workflow?: ApprovalWorkflow;
  actions?: ApprovalAction[];
}

export interface CreateApprovalRequestInput {
  workflowId: string;
  title: string;
  description?: string;
  amount?: number;
}

export interface ApprovalActionInput {
  comments?: string;
}
