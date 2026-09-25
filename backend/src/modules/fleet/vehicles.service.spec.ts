import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      vehicle: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      vehicleAssignment: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      vehicleMaintenanceRecord: { create: jest.fn() },
      employee: { findFirst: jest.fn() },
      $transaction: jest.fn((arg) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [VehiclesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(VehiclesService);
  });

  describe('create', () => {
    it('rejects a duplicate plate number within the same company', async () => {
      prisma.vehicle.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(service.create('company-1', 'user-1', { plateNumber: 'ABC-123', make: 'Toyota', model: 'Hilux' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('assign', () => {
    const activeVehicle = {
      id: 'vehicle-1',
      status: 'active',
      assignments: [],
      maintenanceRecords: [],
    };

    it('rejects assigning a vehicle that is in maintenance', async () => {
      prisma.vehicle.findFirst.mockResolvedValue({ ...activeVehicle, status: 'maintenance' });
      await expect(
        service.assign('company-1', 'user-1', 'vehicle-1', { employeeId: 'emp-1', assignedDate: '2026-01-01' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects assigning a vehicle that already has an active assignment', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(activeVehicle);
      prisma.vehicleAssignment.findFirst.mockResolvedValue({ id: 'existing-assignment' });
      await expect(
        service.assign('company-1', 'user-1', 'vehicle-1', { employeeId: 'emp-1', assignedDate: '2026-01-01' }),
      ).rejects.toThrow(ConflictException);
    });

    it('404s when the employee does not belong to the caller company', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(activeVehicle);
      prisma.vehicleAssignment.findFirst.mockResolvedValue(null);
      prisma.employee.findFirst.mockResolvedValue(null);
      await expect(
        service.assign('company-1', 'user-1', 'vehicle-1', { employeeId: 'emp-1', assignedDate: '2026-01-01' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('succeeds when the vehicle is active, unassigned, and the employee is valid', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(activeVehicle);
      prisma.vehicleAssignment.findFirst.mockResolvedValue(null);
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
      prisma.vehicleAssignment.create.mockResolvedValue({ id: 'assignment-1' });

      await expect(
        service.assign('company-1', 'user-1', 'vehicle-1', { employeeId: 'emp-1', assignedDate: '2026-01-01' }),
      ).resolves.toEqual({ id: 'assignment-1' });
    });
  });

  describe('returnVehicle', () => {
    const vehicle = { id: 'vehicle-1', status: 'active', assignments: [], maintenanceRecords: [] };

    it('rejects returning a vehicle with no active assignment', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(vehicle);
      prisma.vehicleAssignment.findFirst.mockResolvedValue(null);
      await expect(service.returnVehicle('company-1', 'vehicle-1', { returnedDate: '2026-01-15' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("rejects a returnedDate before the assignment's assignedDate", async () => {
      prisma.vehicle.findFirst.mockResolvedValue(vehicle);
      prisma.vehicleAssignment.findFirst.mockResolvedValue({ id: 'a-1', assignedDate: new Date('2026-02-01') });
      await expect(service.returnVehicle('company-1', 'vehicle-1', { returnedDate: '2026-01-15' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('succeeds with a valid returnedDate', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(vehicle);
      prisma.vehicleAssignment.findFirst.mockResolvedValue({ id: 'a-1', assignedDate: new Date('2026-01-01') });
      prisma.vehicleAssignment.update.mockResolvedValue({ id: 'a-1', returnedDate: new Date('2026-01-15') });

      await expect(service.returnVehicle('company-1', 'vehicle-1', { returnedDate: '2026-01-15' })).resolves.toBeDefined();
    });
  });

  describe('addMaintenanceRecord — the odometer sanity check', () => {
    it("rejects a service record with an odometer LOWER than the vehicle's current recorded reading", async () => {
      prisma.vehicle.findFirst.mockResolvedValue({ id: 'vehicle-1', odometerReading: 50000, assignments: [], maintenanceRecords: [] });
      await expect(
        service.addMaintenanceRecord('company-1', 'user-1', 'vehicle-1', {
          serviceDate: '2026-01-01',
          serviceType: 'Oil change',
          odometerAtService: 45000,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('accepts a service record with an odometer reading equal to or higher than current, and updates the vehicle', async () => {
      prisma.vehicle.findFirst.mockResolvedValue({ id: 'vehicle-1', odometerReading: 50000, assignments: [], maintenanceRecords: [] });
      prisma.vehicleMaintenanceRecord.create.mockResolvedValue({ id: 'record-1', odometerAtService: 52000 });
      prisma.vehicle.update.mockResolvedValue({ id: 'vehicle-1', odometerReading: 52000 });

      const result = await service.addMaintenanceRecord('company-1', 'user-1', 'vehicle-1', {
        serviceDate: '2026-01-01',
        serviceType: 'Tire rotation',
        odometerAtService: 52000,
      });

      expect(result.id).toBe('record-1');
      const updateCall = prisma.vehicle.update.mock.calls[0][0];
      expect(updateCall.data.odometerReading).toBe(52000);
    });
  });
});
