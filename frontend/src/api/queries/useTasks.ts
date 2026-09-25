import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../endpoints/tasks';
import type {
  TaskFilters,
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  AssignTaskInput,
  CreateTaskDependencyInput,
} from '../../types/entities/task';

export function useTasks(filters: TaskFilters) {
  return useQuery({ queryKey: ['tasks', 'list', filters], queryFn: () => tasksApi.list(filters) });
}

export function useTask(id: string | undefined) {
  return useQuery({ queryKey: ['tasks', 'detail', id], queryFn: () => tasksApi.get(id!), enabled: !!id });
}

function invalidateTask(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['tasks', 'detail', id] });
  queryClient.invalidateQueries({ queryKey: ['tasks', 'list'] });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => tasksApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', 'list'] }),
  });
}

export function useUpdateTask(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => tasksApi.update(id, input),
    onSuccess: () => invalidateTask(queryClient, id),
  });
}

export function useUpdateTaskStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTaskStatusInput) => tasksApi.updateStatus(id, input),
    onSuccess: () => invalidateTask(queryClient, id),
  });
}

export function useAssignTask(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignTaskInput) => tasksApi.assign(id, input),
    onSuccess: () => invalidateTask(queryClient, id),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', 'list'] }),
  });
}

export function useAddTaskDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: CreateTaskDependencyInput }) => tasksApi.addDependency(taskId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useRemoveTaskDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dependencyId: string) => tasksApi.removeDependency(dependencyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}
