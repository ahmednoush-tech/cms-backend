import { apiRequest } from '../client';
import type { PaginationMeta } from '../../types/api';
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  AssignTaskInput,
  TaskFilters,
  CreateTaskDependencyInput,
} from '../../types/entities/task';

/** Confirmed 1:1 against backend/src/modules/tasks/tasks.controller.ts. */
export const tasksApi = {
  list: async (filters: TaskFilters): Promise<{ items: Task[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<Task[]>({ method: 'GET', url: '/tasks', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<Task> => {
    const { data } = await apiRequest<Task>({ method: 'GET', url: `/tasks/${id}` });
    return data;
  },
  create: async (input: CreateTaskInput): Promise<Task> => {
    const { data } = await apiRequest<Task>({ method: 'POST', url: '/tasks', data: input });
    return data;
  },
  update: async (id: string, input: UpdateTaskInput): Promise<Task> => {
    const { data } = await apiRequest<Task>({ method: 'PATCH', url: `/tasks/${id}`, data: input });
    return data;
  },
  updateStatus: async (id: string, input: UpdateTaskStatusInput): Promise<Task> => {
    const { data } = await apiRequest<Task>({ method: 'PATCH', url: `/tasks/${id}/status`, data: input });
    return data;
  },
  assign: async (id: string, input: AssignTaskInput): Promise<Task> => {
    const { data } = await apiRequest<Task>({ method: 'POST', url: `/tasks/${id}/assign`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/tasks/${id}` });
  },
  addDependency: async (taskId: string, input: CreateTaskDependencyInput) => {
    const { data } = await apiRequest({ method: 'POST', url: `/tasks/${taskId}/dependencies`, data: input });
    return data;
  },
  removeDependency: async (dependencyId: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/tasks/dependencies/${dependencyId}` });
  },
};
