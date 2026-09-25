import { apiRequest } from '../client';
import type {
  Vehicle,
  CreateVehicleInput,
  UpdateVehicleInput,
  AssignVehicleInput,
  ReturnVehicleInput,
  CreateMaintenanceRecordInput,
  VehicleMaintenanceRecord,
} from '../../types/entities/vehicle';

/** Confirmed 1:1 against backend/src/modules/fleet/vehicles.controller.ts. */
export const vehiclesApi = {
  list: async (): Promise<Vehicle[]> => {
    const { data } = await apiRequest<Vehicle[]>({ method: 'GET', url: '/vehicles' });
    return data;
  },
  get: async (id: string): Promise<Vehicle> => {
    const { data } = await apiRequest<Vehicle>({ method: 'GET', url: `/vehicles/${id}` });
    return data;
  },
  create: async (input: CreateVehicleInput): Promise<Vehicle> => {
    const { data } = await apiRequest<Vehicle>({ method: 'POST', url: '/vehicles', data: input });
    return data;
  },
  update: async (id: string, input: UpdateVehicleInput): Promise<Vehicle> => {
    const { data } = await apiRequest<Vehicle>({ method: 'PATCH', url: `/vehicles/${id}`, data: input });
    return data;
  },
  assign: async (id: string, input: AssignVehicleInput) => {
    const { data } = await apiRequest({ method: 'POST', url: `/vehicles/${id}/assign`, data: input });
    return data;
  },
  returnVehicle: async (id: string, input: ReturnVehicleInput) => {
    const { data } = await apiRequest({ method: 'POST', url: `/vehicles/${id}/return`, data: input });
    return data;
  },
  addMaintenanceRecord: async (id: string, input: CreateMaintenanceRecordInput): Promise<VehicleMaintenanceRecord> => {
    const { data } = await apiRequest<VehicleMaintenanceRecord>({ method: 'POST', url: `/vehicles/${id}/maintenance-records`, data: input });
    return data;
  },
};
