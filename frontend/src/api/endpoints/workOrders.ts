import { apiRequest } from '../client';
import type { PaginationMeta } from '../../types/api';
import type {
  WorkOrder,
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
  UpdateWorkOrderStatusInput,
  AssignWorkOrderInput,
  WorkOrderFilters,
} from '../../types/entities/workOrder';

/** Confirmed 1:1 against backend/src/modules/work-orders/work-orders.controller.ts. */
export const workOrdersApi = {
  list: async (filters: WorkOrderFilters): Promise<{ items: WorkOrder[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<WorkOrder[]>({ method: 'GET', url: '/work-orders', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<WorkOrder> => {
    const { data } = await apiRequest<WorkOrder>({ method: 'GET', url: `/work-orders/${id}` });
    return data;
  },
  create: async (input: CreateWorkOrderInput): Promise<WorkOrder> => {
    const { data } = await apiRequest<WorkOrder>({ method: 'POST', url: '/work-orders', data: input });
    return data;
  },
  update: async (id: string, input: UpdateWorkOrderInput): Promise<WorkOrder> => {
    const { data } = await apiRequest<WorkOrder>({ method: 'PATCH', url: `/work-orders/${id}`, data: input });
    return data;
  },
  updateStatus: async (id: string, input: UpdateWorkOrderStatusInput): Promise<WorkOrder> => {
    const { data } = await apiRequest<WorkOrder>({ method: 'PATCH', url: `/work-orders/${id}/status`, data: input });
    return data;
  },
  assign: async (id: string, input: AssignWorkOrderInput): Promise<WorkOrder> => {
    const { data } = await apiRequest<WorkOrder>({ method: 'POST', url: `/work-orders/${id}/assign`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/work-orders/${id}` });
  },
};
