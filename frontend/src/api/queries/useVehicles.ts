import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi } from '../endpoints/vehicles';
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
  AssignVehicleInput,
  ReturnVehicleInput,
  CreateMaintenanceRecordInput,
} from '../../types/entities/vehicle';

export function useVehicles() {
  return useQuery({ queryKey: ['vehicles', 'list'], queryFn: () => vehiclesApi.list() });
}

export function useVehicle(id: string | undefined) {
  return useQuery({ queryKey: ['vehicles', 'detail', id], queryFn: () => vehiclesApi.get(id!), enabled: !!id });
}

function invalidateVehicle(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['vehicles', 'detail', id] });
  queryClient.invalidateQueries({ queryKey: ['vehicles', 'list'] });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVehicleInput) => vehiclesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles', 'list'] }),
  });
}

export function useUpdateVehicle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateVehicleInput) => vehiclesApi.update(id, input),
    onSuccess: () => invalidateVehicle(queryClient, id),
  });
}

export function useAssignVehicle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignVehicleInput) => vehiclesApi.assign(id, input),
    onSuccess: () => invalidateVehicle(queryClient, id),
  });
}

export function useReturnVehicle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReturnVehicleInput) => vehiclesApi.returnVehicle(id, input),
    onSuccess: () => invalidateVehicle(queryClient, id),
  });
}

export function useAddMaintenanceRecord(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaintenanceRecordInput) => vehiclesApi.addMaintenanceRecord(id, input),
    onSuccess: () => invalidateVehicle(queryClient, id),
  });
}
