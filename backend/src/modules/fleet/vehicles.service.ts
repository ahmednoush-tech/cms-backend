import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { AssignVehicleDto } from './dto/assign-vehicle.dto';
import { ReturnVehicleDto } from './dto/return-vehicle.dto';
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, actorUserId: string, dto: CreateVehicleDto) {
    const existing = await this.prisma.vehicle.findFirst({ where: { companyId, plateNumber: dto.plateNumber } });
    if (existing) {
      throw new ConflictException(`A vehicle with plate number '${dto.plateNumber}' already exists.`);
    }

    return this.prisma.vehicle.create({
      data: {
        companyId,
        plateNumber: dto.plateNumber,
        make: dto.make,
        model: dto.model,
        year: dto.year,
        vin: dto.vin,
        odometerReading: dto.odometerReading ?? 0,
        registrationExpiryDate: dto.registrationExpiryDate ? new Date(dto.registrationExpiryDate) : undefined,
        insuranceExpiryDate: dto.insuranceExpiryDate ? new Date(dto.insuranceExpiryDate) : undefined,
        notes: dto.notes,
        createdBy: actorUserId,
      },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.vehicle.findMany({
      where: { companyId },
      include: {
        assignments: {
          where: { returnedDate: null },
          include: { employee: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { plateNumber: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, companyId },
      include: {
        assignments: {
          orderBy: { assignedDate: 'desc' },
          include: { employee: { select: { id: true, firstName: true, lastName: true } } },
        },
        maintenanceRecords: { orderBy: { serviceDate: 'desc' } },
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');
    return vehicle;
  }

  async update(companyId: string, id: string, dto: UpdateVehicleDto) {
    await this.findOne(companyId, id);
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        make: dto.make,
        model: dto.model,
        year: dto.year,
        vin: dto.vin,
        status: dto.status,
        odometerReading: dto.odometerReading,
        registrationExpiryDate: dto.registrationExpiryDate ? new Date(dto.registrationExpiryDate) : undefined,
        insuranceExpiryDate: dto.insuranceExpiryDate ? new Date(dto.insuranceExpiryDate) : undefined,
        notes: dto.notes,
      },
    });
  }

  /**
   * A friendly, application-level version of the SAME check
   * Postgres enforces via a partial unique index on
   * (vehicle_id) WHERE returned_date IS NULL (migration 068) — the
   * DB is the real guarantee against a double-assignment race; this
   * check just turns that into a clear 409 instead of a raw
   * constraint-violation error for the ordinary, non-racing case.
   */
  async assign(companyId: string, actorUserId: string, vehicleId: string, dto: AssignVehicleDto) {
    const vehicle = await this.findOne(companyId, vehicleId);
    if (vehicle.status !== 'active') {
      throw new UnprocessableEntityException(`Vehicle is '${vehicle.status}' and cannot be assigned.`);
    }

    const activeAssignment = await this.prisma.vehicleAssignment.findFirst({ where: { vehicleId, returnedDate: null } });
    if (activeAssignment) {
      throw new ConflictException('This vehicle is already assigned to an employee. Return it first.');
    }

    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!employee) throw new NotFoundException('Employee not found.');

    return this.prisma.vehicleAssignment.create({
      data: {
        vehicleId,
        employeeId: dto.employeeId,
        assignedDate: new Date(dto.assignedDate),
        notes: dto.notes,
        createdBy: actorUserId,
      },
    });
  }

  async returnVehicle(companyId: string, vehicleId: string, dto: ReturnVehicleDto) {
    await this.findOne(companyId, vehicleId);

    const activeAssignment = await this.prisma.vehicleAssignment.findFirst({ where: { vehicleId, returnedDate: null } });
    if (!activeAssignment) {
      throw new UnprocessableEntityException('This vehicle has no active assignment to return.');
    }
    if (new Date(dto.returnedDate) < activeAssignment.assignedDate) {
      throw new UnprocessableEntityException("returnedDate cannot be before the assignment's assignedDate.");
    }

    return this.prisma.vehicleAssignment.update({
      where: { id: activeAssignment.id },
      data: { returnedDate: new Date(dto.returnedDate) },
    });
  }

  /**
   * Rejects a service record with an odometer reading LOWER than
   * the vehicle's currently recorded one — a car's odometer never
   * runs backward, so this is a straightforward, high-value sanity
   * check against a data-entry mistake. When the new reading is
   * higher (the normal case), it becomes the vehicle's new current
   * reading.
   */
  async addMaintenanceRecord(companyId: string, actorUserId: string, vehicleId: string, dto: CreateMaintenanceRecordDto) {
    const vehicle = await this.findOne(companyId, vehicleId);
    if (dto.odometerAtService < vehicle.odometerReading) {
      throw new UnprocessableEntityException(
        `odometerAtService (${dto.odometerAtService}) cannot be less than the vehicle's current recorded reading (${vehicle.odometerReading}).`,
      );
    }

    const [record] = await this.prisma.$transaction([
      this.prisma.vehicleMaintenanceRecord.create({
        data: {
          vehicleId,
          serviceDate: new Date(dto.serviceDate),
          serviceType: dto.serviceType,
          description: dto.description,
          cost: dto.cost ?? 0,
          odometerAtService: dto.odometerAtService,
          performedBy: dto.performedBy,
          createdBy: actorUserId,
        },
      }),
      this.prisma.vehicle.update({ where: { id: vehicleId }, data: { odometerReading: dto.odometerAtService } }),
    ]);

    return record;
  }
}
