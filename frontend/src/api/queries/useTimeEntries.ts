import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { timeEntriesApi } from '../endpoints/timeEntries';
import type { CreateTimeEntryInput, UpdateTimeEntryInput } from '../../types/entities/timeEntry';

export function useTimeEntriesForTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ['timeEntries', 'byTask', taskId],
    queryFn: () => timeEntriesApi.listForTask(taskId!),
    enabled: !!taskId,
  });
}

export function useTaskTimeSummary(taskId: string | undefined) {
  return useQuery({
    queryKey: ['timeEntries', 'taskSummary', taskId],
    queryFn: () => timeEntriesApi.getTaskSummary(taskId!),
    enabled: !!taskId,
  });
}

export function useWorkOrderTimeSummary(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['timeEntries', 'workOrderSummary', workOrderId],
    queryFn: () => timeEntriesApi.getWorkOrderSummary(workOrderId!),
    enabled: !!workOrderId,
  });
}

export function useProjectTimeSummary(projectId: string | undefined) {
  return useQuery({
    queryKey: ['timeEntries', 'projectSummary', projectId],
    queryFn: () => timeEntriesApi.getProjectSummary(projectId!),
    enabled: !!projectId,
  });
}

export function useTimeEntriesForEmployee(employeeId: string | undefined, fromDate: string | null, toDate: string | null) {
  return useQuery({
    queryKey: ['timeEntries', 'byEmployee', employeeId, fromDate, toDate],
    queryFn: () => timeEntriesApi.listForEmployee(employeeId!, fromDate!, toDate!),
    enabled: !!employeeId && !!fromDate && !!toDate,
  });
}

function invalidateTaskTime(queryClient: ReturnType<typeof useQueryClient>, taskId: string) {
  queryClient.invalidateQueries({ queryKey: ['timeEntries', 'byTask', taskId] });
  queryClient.invalidateQueries({ queryKey: ['timeEntries', 'taskSummary', taskId] });
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTimeEntryInput) => timeEntriesApi.create(input),
    onSuccess: (_data, variables) => invalidateTaskTime(queryClient, variables.taskId),
  });
}

export function useUpdateTimeEntry(id: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTimeEntryInput) => timeEntriesApi.update(id, input),
    onSuccess: () => invalidateTaskTime(queryClient, taskId),
  });
}

export function useDeleteTimeEntry(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => timeEntriesApi.remove(id),
    onSuccess: () => invalidateTaskTime(queryClient, taskId),
  });
}
