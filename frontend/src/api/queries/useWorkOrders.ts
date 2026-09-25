import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workOrdersApi } from '../endpoints/workOrders';
import type {
  WorkOrderFilters,
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
  UpdateWorkOrderStatusInput,
  AssignWorkOrderInput,
} from '../../types/entities/workOrder';

export function useWorkOrders(filters: WorkOrderFilters) {
  return useQuery({ queryKey: ['workOrders', 'list', filters], queryFn: () => workOrdersApi.list(filters) });
}

export function useWorkOrder(id: string | undefined) {
  return useQuery({ queryKey: ['workOrders', 'detail', id], queryFn: () => workOrdersApi.get(id!), enabled: !!id });
}

function invalidateWorkOrder(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['workOrders', 'detail', id] });
  queryClient.invalidateQueries({ queryKey: ['workOrders', 'list'] });
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkOrderInput) => workOrdersApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workOrders', 'list'] }),
  });
}

export function useUpdateWorkOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWorkOrderInput) => workOrdersApi.update(id, input),
    onSuccess: () => invalidateWorkOrder(queryClient, id),
  });
}

export function useUpdateWorkOrderStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWorkOrderStatusInput) => workOrdersApi.updateStatus(id, input),
    onSuccess: () => invalidateWorkOrder(queryClient, id),
  });
}

export function useAssignWorkOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignWorkOrderInput) => workOrdersApi.assign(id, input),
    onSuccess: () => invalidateWorkOrder(queryClient, id),
  });
}

export function useDeleteWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workOrdersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workOrders', 'list'] }),
  });
}
