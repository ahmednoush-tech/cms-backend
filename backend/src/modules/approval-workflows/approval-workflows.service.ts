import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApprovalWorkflowDto, UpdateApprovalWorkflowDto, WorkflowStepInputDto } from './dto/approval-workflow.dto';

@Injectable()
export class ApprovalWorkflowsService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.approvalWorkflow.findMany({
      where: { companyId },
      include: { steps: { orderBy: { stepOrder: 'asc' }, include: { approverRole: { select: { id: true, name: true } } } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: { id, companyId },
      include: { steps: { orderBy: { stepOrder: 'asc' }, include: { approverRole: { select: { id: true, name: true } } } } },
    });
    if (!workflow) throw new NotFoundException('Approval workflow not found.');
    return workflow;
  }

  /** Every approverRoleId must be a REAL role belonging to this company — never trusted as an arbitrary UUID. */
  private async assertValidRoles(companyId: string, steps: WorkflowStepInputDto[]) {
    const roleIds = steps.map((s) => s.approverRoleId);
    const found = await this.prisma.role.findMany({ where: { id: { in: roleIds }, companyId }, select: { id: true } });
    const foundIds = new Set(found.map((r) => r.id));
    const missing = roleIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new UnprocessableEntityException(`Unknown role id(s) for this company: ${missing.join(', ')}`);
    }
  }

  async create(companyId: string, dto: CreateApprovalWorkflowDto) {
    await this.assertValidRoles(companyId, dto.steps);

    return this.prisma.approvalWorkflow.create({
      data: {
        companyId,
        name: dto.name,
        steps: { create: dto.steps.map((s, index) => ({ stepOrder: index + 1, approverRoleId: s.approverRoleId })) },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  async update(companyId: string, id: string, dto: UpdateApprovalWorkflowDto) {
    await this.findOne(companyId, id);

    if (dto.steps) {
      await this.assertValidRoles(companyId, dto.steps);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.steps) {
        await tx.approvalWorkflowStep.deleteMany({ where: { workflowId: id } });
        await tx.approvalWorkflowStep.createMany({
          data: dto.steps.map((s, index) => ({ workflowId: id, stepOrder: index + 1, approverRoleId: s.approverRoleId })),
        });
      }
      return tx.approvalWorkflow.update({
        where: { id },
        data: { name: dto.name, isActive: dto.isActive },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });
    });
  }
}
