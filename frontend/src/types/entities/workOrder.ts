export interface WorkOrder {
  id: string;
  companyId: string;
  projectId: string;
  customerId: string;
  workOrderNumber: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'new' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  assignedToEmployeeId: string | null;
  /** Included on both GET /work-orders (list) and GET /work-orders/:id — selected fields only. */
  assignee?: { id: string; firstName: string; lastName: string } | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** customerId is NOT accepted here — always server-derived from the parent project (confirmed this session). */
export interface CreateWorkOrderInput {
  projectId: string;
  title: string;
  description?: string;
  priority?: WorkOrder['priority'];
  assignedToEmployeeId?: string;
  dueDate?: string;
}

export interface UpdateWorkOrderInput {
  title?: string;
  description?: string;
  priority?: WorkOrder['priority'];
  dueDate?: string;
}

export interface UpdateWorkOrderStatusInput {
  status: WorkOrder['status'];
}

export interface AssignWorkOrderInput {
  employeeId: string;
}

export interface WorkOrderFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  projectId?: string;
  status?: string;
  assignedToEmployeeId?: string;
}
