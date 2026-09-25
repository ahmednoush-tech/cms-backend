import { apiRequest } from '../client';
import type { TimeEntry, CreateTimeEntryInput, UpdateTimeEntryInput, TimeEntrySummary } from '../../types/entities/timeEntry';

/** Confirmed 1:1 against backend/src/modules/time-entries/time-entries.controller.ts. */
export const timeEntriesApi = {
  create: async (input: CreateTimeEntryInput): Promise<TimeEntry> => {
    const { data } = await apiRequest<TimeEntry>({ method: 'POST', url: '/time-entries', data: input });
    return data;
  },
  get: async (id: string): Promise<TimeEntry> => {
    const { data } = await apiRequest<TimeEntry>({ method: 'GET', url: `/time-entries/${id}` });
    return data;
  },
  update: async (id: string, input: UpdateTimeEntryInput): Promise<TimeEntry> => {
    const { data } = await apiRequest<TimeEntry>({ method: 'PATCH', url: `/time-entries/${id}`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/time-entries/${id}` });
  },
  listForTask: async (taskId: string): Promise<TimeEntry[]> => {
    const { data } = await apiRequest<TimeEntry[]>({ method: 'GET', url: `/time-entries/by-task/${taskId}` });
    return data;
  },
  getTaskSummary: async (taskId: string): Promise<TimeEntrySummary> => {
    const { data } = await apiRequest<TimeEntrySummary>({ method: 'GET', url: `/time-entries/by-task/${taskId}/summary` });
    return data;
  },
  getWorkOrderSummary: async (workOrderId: string): Promise<TimeEntrySummary> => {
    const { data } = await apiRequest<TimeEntrySummary>({ method: 'GET', url: `/time-entries/by-work-order/${workOrderId}/summary` });
    return data;
  },
  getProjectSummary: async (projectId: string): Promise<TimeEntrySummary> => {
    const { data } = await apiRequest<TimeEntrySummary>({ method: 'GET', url: `/time-entries/by-project/${projectId}/summary` });
    return data;
  },
  listForEmployee: async (employeeId: string, fromDate: string, toDate: string): Promise<TimeEntry[]> => {
    const { data } = await apiRequest<TimeEntry[]>({ method: 'GET', url: `/time-entries/by-employee/${employeeId}`, params: { fromDate, toDate } });
    return data;
  },
};
