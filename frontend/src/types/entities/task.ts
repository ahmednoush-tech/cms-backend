export interface Task {
  id: string;
  companyId: string;
  projectId: string | null;
  workOrderId: string | null;
  title: string;
  description: string | null;
  assignedToEmployeeId: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** GET /tasks (list) AND GET /tasks/:id — selected fields only. */
  assignee?: { id: string; firstName: string; lastName: string } | null;
  /** GET /tasks/:id only (confirmed against tasks.service.ts findOne). */
  project?: { id: string; projectNumber: string; name: string } | null;
  /** GET /tasks/:id only. */
  workOrder?: { id: string; workOrderNumber: string } | null;
}

export interface GanttTaskDependency {
  id: string;
  dependsOnTaskId: string;
}

export interface GanttTask {
  id: string;
  title: string;
  status: Task['status'];
  priority: Task['priority'];
  startDate: string | null;
  dueDate: string | null;
  /** Included on both GET /tasks (list) and GET /tasks/:id — selected fields only. */
  assignee?: { id: string; firstName: string; lastName: string } | null;
  project?: { id: string; projectNumber: string; name: string } | null;
  workOrder?: { id: string; workOrderNumber: string } | null;
  dependencies: GanttTaskDependency[];
}

export interface GanttData {
  project: { id: string; name: string; startDate: string | null; endDate: string | null };
  tasks: GanttTask[];
}

export interface CreateTaskDependencyInput {
  dependsOnTaskId: string;
}

/** At least one of projectId/workOrderId is required (backend rule, confirmed — also DB-enforced via chk_task_parent). */
export interface CreateTaskInput {
  projectId?: string;
  workOrderId?: string;
  title: string;
  description?: string;
  priority?: Task['priority'];
  assignedToEmployeeId?: string;
  startDate?: string;
  dueDate?: string;
}

/** projectId/workOrderId are immutable after creation (confirmed — not offered by the backend at all post-create). */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: Task['priority'];
  startDate?: string;
  dueDate?: string;
}

export interface UpdateTaskStatusInput {
  status: Task['status'];
}

export interface AssignTaskInput {
  employeeId: string;
}

export interface TaskFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  projectId?: string;
  workOrderId?: string;
  status?: string;
  assignedToEmployeeId?: string;
}
