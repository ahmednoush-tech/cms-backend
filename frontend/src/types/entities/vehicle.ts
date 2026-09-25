export type VehicleStatus = 'active' | 'maintenance' | 'retired';

export interface VehicleAssignment {
  id: string;
  vehicleId: string;
  employeeId: string;
  assignedDate: string;
  returnedDate: string | null;
  notes: string | null;
  createdAt: string;
  employee?: { id: string; firstName: string; lastName: string };
}

export interface VehicleMaintenanceRecord {
  id: string;
  vehicleId: string;
  serviceDate: string;
  serviceType: string;
  description: string | null;
  cost: string;
  odometerAtService: number;
  performedBy: string | null;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  companyId: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number | null;
  vin: string | null;
  status: VehicleStatus;
  odometerReading: number;
  registrationExpiryDate: string | null;
  insuranceExpiryDate: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  assignments?: VehicleAssignment[];
  maintenanceRecords?: VehicleMaintenanceRecord[];
}

export interface CreateVehicleInput {
  plateNumber: string;
  make: string;
  model: string;
  year?: number;
  vin?: string;
  odometerReading?: number;
  registrationExpiryDate?: string;
  insuranceExpiryDate?: string;
  notes?: string;
}

export interface UpdateVehicleInput {
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  status?: VehicleStatus;
  odometerReading?: number;
  registrationExpiryDate?: string;
  insuranceExpiryDate?: string;
  notes?: string;
}

export interface AssignVehicleInput {
  employeeId: string;
  assignedDate: string;
  notes?: string;
}

export interface ReturnVehicleInput {
  returnedDate: string;
}

export interface CreateMaintenanceRecordInput {
  serviceDate: string;
  serviceType: string;
  description?: string;
  cost?: number;
  odometerAtService: number;
  performedBy?: string;
}
