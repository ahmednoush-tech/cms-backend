import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { ProjectsService } from '../projects/projects.service';
import {
  LEAD_TRANSITIONS,
  OPPORTUNITY_TRANSITIONS,
  QUOTATION_TRANSITIONS,
  PROJECT_TRANSITIONS,
  WORK_ORDER_TRANSITIONS,
  TASK_TRANSITIONS,
} from '../../common/services/workflow-transition.validator';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';

const { Decimal } = Prisma;

const LEAD_STATUSES = Object.keys(LEAD_TRANSITIONS);
const OPPORTUNITY_STAGES = Object.keys(OPPORTUNITY_TRANSITIONS);
const QUOTATION_STATUSES = Object.keys(QUOTATION_TRANSITIONS);
const PROJECT_STATUSES = Object.keys(PROJECT_TRANSITIONS);
const WORK_ORDER_STATUSES = Object.keys(WORK_ORDER_TRANSITIONS);
const TASK_STATUSES = Object.keys(TASK_TRANSITIONS);
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

interface ValidatedFilters {
  dateFrom?: Date;
  dateTo?: Date;
  departmentId?: string;
  employeeId?: string;
  customerId?: string;
  projectId?: string;
  status?: string;
  priority?: string;
}

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private customersService: CustomersService,
    private projectsService: ProjectsService,
  ) {}

  /**
   * "Has CRM view access" / "has Operations view access" is
   * anchored on the SAME specific permission the standard guard
   * uses for /sales and /operations respectively
   * (CRM:customers:view / Operations:projects:view) — deliberately
   * kept in sync with the controller's @Permissions() checks on
   * those routes, so /summary's inclusion logic can never disagree
   * with what /sales or /operations would independently allow.
   * Every seeded role (Sales, Operations, Super Admin) grants the
   * view permissions for its module together as a set, so this
   * anchor is representative in practice; a role with a partial,
   * hand-picked permission set (e.g. only CRM:leads:view without
   * CRM:customers:view) would not be treated as having CRM access
   * — flagged as a documented anchor choice, not a bug.
   */
  // ============================================================
  // Access model (Phase 2E decision 1)
  // ============================================================

  private computeAccess(permissions: string[]) {
    const hasCrm = permissions.includes('CRM:customers:view');
    const hasOperations = permissions.includes('Operations:projects:view');
    return { hasCrm, hasOperations };
  }

  async getSummary(companyId: string, permissions: string[], rawFilters: DashboardFiltersDto) {
    const { hasCrm, hasOperations } = this.computeAccess(permissions);
    if (!hasCrm && !hasOperations) {
      throw new ForbiddenException('You do not have permission to view any Dashboard section.');
    }

    const filters = await this.validateFilters(companyId, rawFilters);
    const [crm, operations] = await Promise.all([
      hasCrm ? this.buildCrmSummary(companyId, filters) : Promise.resolve(undefined),
      hasOperations ? this.buildOperationsSummary(companyId, filters) : Promise.resolve(undefined),
    ]);

    const result: Record<string, unknown> = {};
    if (crm) Object.assign(result, crm);
    if (operations) Object.assign(result, operations);
    return result;
  }

  async getSales(companyId: string, rawFilters: DashboardFiltersDto) {
    const filters = await this.validateFilters(companyId, rawFilters);
    return this.buildCrmSales(companyId, filters);
  }

  async getOperations(companyId: string, rawFilters: DashboardFiltersDto) {
    const filters = await this.validateFilters(companyId, rawFilters);
    return this.buildOperationsBreakdown(companyId, filters);
  }

  async getWorkload(companyId: string, rawFilters: DashboardFiltersDto) {
    const filters = await this.validateFilters(companyId, rawFilters);
    return this.buildWorkload(companyId, filters);
  }

  private async buildCrmSummary(companyId: string, filters: ValidatedFilters) {
    const [totalCustomers, newLeads, openOpportunities, pipelineValue] = await Promise.all([
      this.totalCustomers(companyId),
      this.newLeads(companyId, filters),
      this.openOpportunities(companyId, filters),
      this.pipelineValue(companyId, filters),
    ]);
    return { totalCustomers, newLeads, openOpportunities, pipelineValue };
  }

  private async buildOperationsSummary(companyId: string, filters: ValidatedFilters) {
    const [
      activeProjects,
      completedProjects,
      openWorkOrders,
      overdueWorkOrders,
      pendingTasks,
      completedTasks,
      totalOpenAssignments,
    ] = await Promise.all([
      this.activeProjects(companyId, filters),
      this.completedProjects(companyId, filters),
      this.openWorkOrders(companyId, filters),
      this.overdueWorkOrders(companyId, filters),
      this.pendingTasks(companyId, filters),
      this.completedTasks(companyId, filters),
      this.totalOpenAssignments(companyId, filters),
    ]);
    return {
      activeProjects,
      completedProjects,
      openWorkOrders,
      overdueWorkOrders,
      pendingTasks,
      completedTasks,
      totalOpenAssignments,
    };
  }

  private async buildCrmSales(companyId: string, filters: ValidatedFilters) {
    const [
      leadsByStatus,
      opportunitiesByStage,
      pipelineValue,
      opportunitiesWonLost,
      conversionRate,
      quotationsByStatus,
      quotationValueByStatus,
      acceptedQuotationValue,
    ] = await Promise.all([
      this.leadsByStatus(companyId, filters),
      this.opportunitiesByStage(companyId, filters),
      this.pipelineValue(companyId, filters),
      this.opportunitiesWonLost(companyId, filters),
      this.conversionRate(companyId, filters),
      this.quotationsByStatus(companyId, filters),
      this.quotationValueByStatus(companyId, filters),
      this.acceptedQuotationValue(companyId, filters),
    ]);
    return {
      leadsByStatus,
      opportunitiesByStage,
      pipelineValue,
      opportunitiesWonLost,
      conversionRate,
      quotationsByStatus,
      quotationValueByStatus,
      acceptedQuotationValue,
    };
  }

  private async buildOperationsBreakdown(companyId: string, filters: ValidatedFilters) {
    const [
      projectsByStatus,
      workOrdersByStatus,
      workOrdersByPriority,
      overdueWorkOrders,
      tasksByStatus,
      tasksByPriority,
    ] = await Promise.all([
      this.projectsByStatus(companyId, filters),
      this.workOrdersByStatus(companyId, filters),
      this.workOrdersByPriority(companyId, filters),
      this.overdueWorkOrders(companyId, filters),
      this.tasksByStatus(companyId, filters),
      this.tasksByPriority(companyId, filters),
    ]);
    return {
      projectsByStatus,
      workOrdersByStatus,
      workOrdersByPriority,
      overdueWorkOrders,
      tasksByStatus,
      tasksByPriority,
    };
  }

  private async buildWorkload(companyId: string, filters: ValidatedFilters) {
    const [openTasksByEmployee, openWorkOrdersByEmployee] = await Promise.all([
      this.openTasksByEmployee(companyId, filters),
      this.openWorkOrdersByEmployee(companyId, filters),
    ]);

    const totalOpenAssignmentsByEmployee: Record<string, number> = {};
    for (const [employeeId, count] of Object.entries(openTasksByEmployee)) {
      totalOpenAssignmentsByEmployee[employeeId] = (totalOpenAssignmentsByEmployee[employeeId] ?? 0) + count;
    }
    for (const [employeeId, count] of Object.entries(openWorkOrdersByEmployee)) {
      totalOpenAssignmentsByEmployee[employeeId] = (totalOpenAssignmentsByEmployee[employeeId] ?? 0) + count;
    }

    return { openTasksByEmployee, openWorkOrdersByEmployee, totalOpenAssignmentsByEmployee };
  }

  private async totalCustomers(companyId: string): Promise<number> {
    return this.prisma.customer.count({ where: { companyId, deletedAt: null } });
  }

  private async newLeads(companyId: string, f: ValidatedFilters): Promise<number> {
    return this.prisma.lead.count({
      where: { companyId, deletedAt: null, createdAt: this.dateRange(f) },
    });
  }

  private async leadsByStatus(companyId: string, f: ValidatedFilters) {
    const grouped = await this.prisma.lead.groupBy({
      by: ['status'],
      where: { companyId, deletedAt: null, createdAt: this.dateRange(f) },
      _count: { status: true },
    });
    return this.zeroFill(LEAD_STATUSES, grouped, (g) => g.status, (g) => g._count.status);
  }

  private async openOpportunities(companyId: string, f: ValidatedFilters): Promise<number> {
    return this.prisma.opportunity.count({
      where: {
        companyId,
        deletedAt: null,
        stage: { notIn: ['won', 'lost'] },
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
    });
  }

  private async pipelineValue(companyId: string, f: ValidatedFilters): Promise<string> {
    const result = await this.prisma.opportunity.aggregate({
      where: {
        companyId,
        deletedAt: null,
        stage: { notIn: ['won', 'lost'] },
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
      _sum: { value: true },
    });
    return (result._sum.value ?? new Decimal(0)).toFixed(2);
  }

  private async opportunitiesByStage(companyId: string, f: ValidatedFilters) {
    const grouped = await this.prisma.opportunity.groupBy({
      by: ['stage'],
      where: {
        companyId,
        deletedAt: null,
        createdAt: this.dateRange(f),
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
      _count: { stage: true },
    });
    return this.zeroFill(OPPORTUNITY_STAGES, grouped, (g) => g.stage, (g) => g._count.stage);
  }

  private async opportunitiesWonLost(companyId: string, f: ValidatedFilters) {
    const grouped = await this.prisma.opportunity.groupBy({
      by: ['stage'],
      where: {
        companyId,
        deletedAt: null,
        stage: { in: ['won', 'lost'] },
        updatedAt: this.dateRange(f),
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
      _count: { stage: true },
    });
    const won = grouped.find((g) => g.stage === 'won')?._count.stage ?? 0;
    const lost = grouped.find((g) => g.stage === 'lost')?._count.stage ?? 0;
    return { won, lost };
  }

  private async conversionRate(companyId: string, f: ValidatedFilters): Promise<number> {
    const grouped = await this.prisma.opportunity.groupBy({
      by: ['stage'],
      where: {
        companyId,
        deletedAt: null,
        stage: { in: ['won', 'lost'] },
        createdAt: this.dateRange(f),
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
      _count: { stage: true },
    });
    const won = grouped.find((g) => g.stage === 'won')?._count.stage ?? 0;
    const lost = grouped.find((g) => g.stage === 'lost')?._count.stage ?? 0;
    const denominator = won + lost;
    return denominator === 0 ? 0 : won / denominator;
  }

  private async quotationsByStatus(companyId: string, f: ValidatedFilters) {
    const grouped = await this.prisma.quotation.groupBy({
      by: ['status'],
      where: {
        companyId,
        deletedAt: null,
        createdAt: this.dateRange(f),
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
      _count: { status: true },
    });
    return this.zeroFill(QUOTATION_STATUSES, grouped, (g) => g.status, (g) => g._count.status);
  }

  private async quotationValueByStatus(companyId: string, f: ValidatedFilters) {
    const grouped = await this.prisma.quotation.groupBy({
      by: ['status'],
      where: {
        companyId,
        deletedAt: null,
        createdAt: this.dateRange(f),
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
      _sum: { total: true },
    });
    const result: Record<string, string> = {};
    for (const status of QUOTATION_STATUSES) result[status] = '0.00';
    for (const g of grouped) result[g.status] = (g._sum.total ?? new Decimal(0)).toFixed(2);
    return result;
  }

  private async acceptedQuotationValue(companyId: string, f: ValidatedFilters): Promise<string> {
    const result = await this.prisma.quotation.aggregate({
      where: {
        companyId,
        deletedAt: null,
        status: 'accepted',
        updatedAt: this.dateRange(f),
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
      _sum: { total: true },
    });
    return (result._sum.total ?? new Decimal(0)).toFixed(2);
  }

  private async activeProjects(companyId: string, f: ValidatedFilters): Promise<number> {
    return this.prisma.project.count({
      where: { companyId, deletedAt: null, status: 'in_progress', ...(f.customerId ? { customerId: f.customerId } : {}) },
    });
  }

  private async completedProjects(companyId: string, f: ValidatedFilters): Promise<number> {
    return this.prisma.project.count({
      where: { companyId, deletedAt: null, status: 'completed', ...(f.customerId ? { customerId: f.customerId } : {}) },
    });
  }

  private async projectsByStatus(companyId: string, f: ValidatedFilters) {
    const grouped = await this.prisma.project.groupBy({
      by: ['status'],
      where: {
        companyId,
        deletedAt: null,
        createdAt: this.dateRange(f),
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
      _count: { status: true },
    });
    return this.zeroFill(PROJECT_STATUSES, grouped, (g) => g.status, (g) => g._count.status);
  }

  private async openWorkOrders(companyId: string, f: ValidatedFilters): Promise<number> {
    return this.prisma.workOrder.count({
      where: {
        companyId,
        deletedAt: null,
        status: { notIn: ['completed', 'cancelled'] },
        ...(f.projectId ? { projectId: f.projectId } : {}),
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
    });
  }

  private async overdueWorkOrders(companyId: string, f: ValidatedFilters): Promise<number> {
    return this.prisma.workOrder.count({
      where: {
        companyId,
        deletedAt: null,
        status: { notIn: ['completed', 'cancelled'] },
        dueDate: { lt: new Date() },
        ...(f.projectId ? { projectId: f.projectId } : {}),
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
    });
  }

  private async workOrdersByStatus(companyId: string, f: ValidatedFilters) {
    const grouped = await this.prisma.workOrder.groupBy({
      by: ['status'],
      where: {
        companyId,
        deletedAt: null,
        createdAt: this.dateRange(f),
        ...(f.projectId ? { projectId: f.projectId } : {}),
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
      _count: { status: true },
    });
    return this.zeroFill(WORK_ORDER_STATUSES, grouped, (g) => g.status, (g) => g._count.status);
  }

  private async workOrdersByPriority(companyId: string, f: ValidatedFilters) {
    const grouped = await this.prisma.workOrder.groupBy({
      by: ['priority'],
      where: {
        companyId,
        deletedAt: null,
        ...(f.projectId ? { projectId: f.projectId } : {}),
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
      _count: { priority: true },
    });
    return this.zeroFill(PRIORITIES, grouped, (g) => g.priority, (g) => g._count.priority);
  }

  private async pendingTasks(companyId: string, f: ValidatedFilters): Promise<number> {
    return this.prisma.task.count({
      where: { companyId, deletedAt: null, status: 'pending', ...(f.projectId ? { projectId: f.projectId } : {}) },
    });
  }

  private async completedTasks(companyId: string, f: ValidatedFilters): Promise<number> {
    return this.prisma.task.count({
      where: { companyId, deletedAt: null, status: 'completed', ...(f.projectId ? { projectId: f.projectId } : {}) },
    });
  }

  private async tasksByStatus(companyId: string, f: ValidatedFilters) {
    const grouped = await this.prisma.task.groupBy({
      by: ['status'],
      where: {
        companyId,
        deletedAt: null,
        createdAt: this.dateRange(f),
        ...(f.projectId ? { projectId: f.projectId } : {}),
      },
      _count: { status: true },
    });
    return this.zeroFill(TASK_STATUSES, grouped, (g) => g.status, (g) => g._count.status);
  }

  private async tasksByPriority(companyId: string, f: ValidatedFilters) {
    const grouped = await this.prisma.task.groupBy({
      by: ['priority'],
      where: {
        companyId,
        deletedAt: null,
        ...(f.projectId ? { projectId: f.projectId } : {}),
      },
      _count: { priority: true },
    });
    return this.zeroFill(PRIORITIES, grouped, (g) => g.priority, (g) => g._count.priority);
  }

  private async openTasksByEmployee(companyId: string, f: ValidatedFilters): Promise<Record<string, number>> {
    const grouped = await this.prisma.task.groupBy({
      by: ['assignedToEmployeeId'],
      where: {
        companyId,
        deletedAt: null,
        status: { notIn: ['completed', 'cancelled'] },
        assignedToEmployeeId: { not: null },
        ...(f.projectId ? { projectId: f.projectId } : {}),
        ...(f.employeeId ? { assignedToEmployeeId: f.employeeId } : {}),
        ...(f.departmentId ? { assignee: { departmentId: f.departmentId } } : {}),
      },
      _count: { assignedToEmployeeId: true },
    });
    const result: Record<string, number> = {};
    for (const g of grouped) {
      if (g.assignedToEmployeeId) result[g.assignedToEmployeeId] = g._count.assignedToEmployeeId;
    }
    return result;
  }

  private async openWorkOrdersByEmployee(companyId: string, f: ValidatedFilters): Promise<Record<string, number>> {
    const grouped = await this.prisma.workOrder.groupBy({
      by: ['assignedToEmployeeId'],
      where: {
        companyId,
        deletedAt: null,
        status: { notIn: ['completed', 'cancelled'] },
        assignedToEmployeeId: { not: null },
        ...(f.projectId ? { projectId: f.projectId } : {}),
        ...(f.employeeId ? { assignedToEmployeeId: f.employeeId } : {}),
        ...(f.departmentId ? { assignee: { departmentId: f.departmentId } } : {}),
      },
      _count: { assignedToEmployeeId: true },
    });
    const result: Record<string, number> = {};
    for (const g of grouped) {
      if (g.assignedToEmployeeId) result[g.assignedToEmployeeId] = g._count.assignedToEmployeeId;
    }
    return result;
  }

  private async totalOpenAssignments(companyId: string, f: ValidatedFilters): Promise<number> {
    const [openTaskCount, openWorkOrderCount] = await Promise.all([
      this.prisma.task.count({
        where: {
          companyId,
          deletedAt: null,
          status: { notIn: ['completed', 'cancelled'] },
          assignedToEmployeeId: { not: null },
          ...(f.projectId ? { projectId: f.projectId } : {}),
          ...(f.employeeId ? { assignedToEmployeeId: f.employeeId } : {}),
          ...(f.departmentId ? { assignee: { departmentId: f.departmentId } } : {}),
        },
      }),
      this.prisma.workOrder.count({
        where: {
          companyId,
          deletedAt: null,
          status: { notIn: ['completed', 'cancelled'] },
          assignedToEmployeeId: { not: null },
          ...(f.projectId ? { projectId: f.projectId } : {}),
          ...(f.employeeId ? { assignedToEmployeeId: f.employeeId } : {}),
          ...(f.departmentId ? { assignee: { departmentId: f.departmentId } } : {}),
        },
      }),
    ]);
    return openTaskCount + openWorkOrderCount;
  }

  private dateRange(f: ValidatedFilters): Prisma.DateTimeFilter | undefined {
    if (!f.dateFrom && !f.dateTo) return undefined;
    const range: Prisma.DateTimeFilter = {};
    if (f.dateFrom) range.gte = f.dateFrom;
    if (f.dateTo) range.lte = f.dateTo;
    return range;
  }

  private zeroFill<T>(
    buckets: string[],
    grouped: T[],
    keyOf: (row: T) => string | null,
    countOf: (row: T) => number,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const bucket of buckets) result[bucket] = 0;
    for (const row of grouped) {
      const key = keyOf(row);
      if (key !== null) result[key] = countOf(row);
    }
    return result;
  }

  private async validateFilters(companyId: string, raw: DashboardFiltersDto): Promise<ValidatedFilters> {
    if (raw.customerId) {
      await this.customersService.assertCustomerBelongsToCompany(companyId, raw.customerId);
    }
    if (raw.projectId) {
      await this.projectsService.assertProjectBelongsToCompany(companyId, raw.projectId);
    }
    if (raw.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: raw.employeeId, companyId },
      });
      if (!employee) {
        throw new ForbiddenException('employeeId filter must reference an employee in the same company.');
      }
    }
    if (raw.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: raw.departmentId, companyId },
      });
      if (!department) {
        throw new ForbiddenException('departmentId filter must reference a department in the same company.');
      }
    }

    return {
      dateFrom: raw.dateFrom ? new Date(raw.dateFrom) : undefined,
      dateTo: raw.dateTo ? new Date(raw.dateTo) : undefined,
      departmentId: raw.departmentId,
      employeeId: raw.employeeId,
      customerId: raw.customerId,
      projectId: raw.projectId,
      status: raw.status,
      priority: raw.priority,
    };
  }
}
