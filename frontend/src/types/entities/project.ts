export interface Project {
  id: string;
  companyId: string;
  customerId: string;
  opportunityId: string | null;
  quotationId: string | null;
  projectNumber: string;
  name: string;
  description: string | null;
  status: 'planning' | 'approved' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  startDate: string | null;
  endDate: string | null;
  budget: string | null;
  projectManagerId: string | null;
  /** Included on GET /projects/:id (findOne) — selected fields only. */
  projectManager?: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTaskCounts {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
}

export interface ProjectProgressAndBudget {
  budget: string | null;
  actualLaborCost: string;
  /** Sum of Bill.total linked to this project via projectId — see backend migration 083. Excludes cancelled bills. */
  actualMaterialCost: string;
  /** actualLaborCost + actualMaterialCost — this is what budgetVariance/budgetUtilizationPercent are computed against. */
  actualTotalCost: string;
  budgetVariance: string | null;
  budgetUtilizationPercent: string | null;
  taskCounts: ProjectTaskCounts;
  percentComplete: string | null;
  health: 'on_track' | 'at_risk';
}

export interface CreateProjectInput {
  customerId: string;
  opportunityId?: string;
  quotationId?: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  projectManagerId?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
}

export interface UpdateProjectStatusInput {
  status: Project['status'];
}

export interface AssignProjectManagerInput {
  employeeId: string;
}

export interface ProjectFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  customerId?: string;
  status?: string;
}

/** project_members.role — free-text VARCHAR(50) on the backend, enforced only at the DTO layer (confirmed this session). */
export const PROJECT_MEMBER_ROLES = ['manager', 'coordinator', 'technician', 'qa', 'support', 'member'] as const;
export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];

export interface ProjectMember {
  projectId: string;
  employeeId: string;
  role: string;
  createdAt: string;
}

export interface AddProjectMemberInput {
  employeeId: string;
  role: string;
}
