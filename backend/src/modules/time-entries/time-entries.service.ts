import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';

const { Decimal } = Prisma;
const MONEY_DP = 2;

@Injectable()
export class TimeEntriesService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, actorUserId: string, dto: CreateTimeEntryDto) {
    const task = await this.prisma.task.findFirst({ where: { id: dto.taskId, companyId, deletedAt: null } });
    if (!task) throw new NotFoundException('Task not found.');

    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found.');

    const hours = new Decimal(dto.hours);
    const rateSnapshot = employee.hourlyRate !== null ? new Decimal(employee.hourlyRate) : null;
    const laborCost = rateSnapshot ? hours.mul(rateSnapshot).toDecimalPlaces(MONEY_DP) : null;

    return this.prisma.timeEntry.create({
      data: {
        companyId,
        taskId: dto.taskId,
        employeeId: dto.employeeId,
        entryDate: new Date(dto.entryDate),
        hours,
        hourlyRateSnapshot: rateSnapshot,
        laborCost,
        notes: dto.notes,
        billable: dto.billable ?? true,
        createdBy: actorUserId,
      },
    });
  }

  async findOne(companyId: string, id: string) {
    const entry = await this.prisma.timeEntry.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!entry) throw new NotFoundException('Time entry not found.');
    return entry;
  }

  async findAllForTask(companyId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, companyId, deletedAt: null } });
    if (!task) throw new NotFoundException('Task not found.');
    return this.prisma.timeEntry.findMany({
      where: { companyId, taskId, deletedAt: null },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { entryDate: 'desc' },
    });
  }

  async findAllForEmployee(companyId: string, employeeId: string, fromDate: Date, toDate: Date) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found.');
    return this.prisma.timeEntry.findMany({
      where: { companyId, employeeId, deletedAt: null, entryDate: { gte: fromDate, lte: toDate } },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { entryDate: 'asc' },
    });
  }

  async update(companyId: string, id: string, dto: UpdateTimeEntryDto) {
    const entry = await this.findOne(companyId, id);

    const hours = dto.hours !== undefined ? new Decimal(dto.hours) : new Decimal(entry.hours);
    const rateSnapshot = entry.hourlyRateSnapshot !== null ? new Decimal(entry.hourlyRateSnapshot) : null;
    const laborCost = rateSnapshot ? hours.mul(rateSnapshot).toDecimalPlaces(MONEY_DP) : null;

    return this.prisma.timeEntry.update({
      where: { id },
      data: {
        entryDate: dto.entryDate ? new Date(dto.entryDate) : undefined,
        hours: dto.hours !== undefined ? hours : undefined,
        laborCost,
        notes: dto.notes,
        billable: dto.billable,
      },
    });
  }

  async softDelete(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.timeEntry.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private summarize(entries: Array<{ hours: Prisma.Decimal | string; laborCost: Prisma.Decimal | string | null; billable: boolean }>) {
    let totalHours = new Decimal(0);
    let billableHours = new Decimal(0);
    let totalCost = new Decimal(0);
    let hasAnyCost = false;

    for (const e of entries) {
      const hours = new Decimal(e.hours);
      totalHours = totalHours.add(hours);
      if (e.billable) billableHours = billableHours.add(hours);
      if (e.laborCost !== null) {
        hasAnyCost = true;
        totalCost = totalCost.add(e.laborCost);
      }
    }

    return {
      totalHours: totalHours.toDecimalPlaces(2).toString(),
      billableHours: billableHours.toDecimalPlaces(2).toString(),
      totalCost: hasAnyCost ? totalCost.toDecimalPlaces(MONEY_DP).toString() : null,
      entryCount: entries.length,
    };
  }

  async getTaskSummary(companyId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, companyId, deletedAt: null } });
    if (!task) throw new NotFoundException('Task not found.');
    const entries = await this.prisma.timeEntry.findMany({ where: { companyId, taskId, deletedAt: null } });
    return this.summarize(entries);
  }

  async getWorkOrderSummary(companyId: string, workOrderId: string) {
    const workOrder = await this.prisma.workOrder.findFirst({ where: { id: workOrderId, companyId, deletedAt: null } });
    if (!workOrder) throw new NotFoundException('Work order not found.');
    const tasks = await this.prisma.task.findMany({ where: { companyId, workOrderId, deletedAt: null }, select: { id: true } });
    const entries = await this.prisma.timeEntry.findMany({
      where: { companyId, taskId: { in: tasks.map((t) => t.id) }, deletedAt: null },
    });
    return this.summarize(entries);
  }

  async getProjectSummary(companyId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, companyId, deletedAt: null } });
    if (!project) throw new NotFoundException('Project not found.');

    const workOrders = await this.prisma.workOrder.findMany({ where: { companyId, projectId, deletedAt: null }, select: { id: true } });
    const tasks = await this.prisma.task.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ projectId }, { workOrderId: { in: workOrders.map((w) => w.id) } }],
      },
      select: { id: true },
    });
    const entries = await this.prisma.timeEntry.findMany({
      where: { companyId, taskId: { in: tasks.map((t) => t.id) }, deletedAt: null },
    });
    return this.summarize(entries);
  }
}
