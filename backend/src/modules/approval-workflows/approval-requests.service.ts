import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApprovalRequestDto, ApprovalActionDto } from './dto/approval-request.dto';
import { COMPANY_WIDE_SCOPE_ID } from '../../common/constants/scope.constants';

@Injectable()
export class ApprovalRequestsService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.approvalRequest.findMany({
      where: { companyId },
      include: { workflow: { select: { id: true, name: true } }, requestedByUser: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id, companyId },
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: 'asc' }, include: { approverRole: { select: { id: true, name: true } } } } } },
        requestedByUser: { select: { id: true, name: true } },
        actions: { orderBy: { actionedAt: 'asc' }, include: { actor: { select: { id: true, name: true } } } },
      },
    });
    if (!request) throw new NotFoundException('Approval request not found.');
    return request;
  }

  /**
   * Returns only requests currently sitting at a step this user
   * can act on — computed by checking the user's ACTUAL roles
   * (via user_roles) against the request's current step's
   * approver_role_id, not by trusting anything from the client.
   */
  async findPendingForUser(companyId: string, userId: string) {
    const userRoles = await this.prisma.userRole.findMany({ where: { userId }, select: { roleId: true } });
    const userRoleIds = new Set(userRoles.map((r) => r.roleId));

    const pending = await this.prisma.approvalRequest.findMany({
      where: { companyId, status: 'pending' },
      include: { workflow: { include: { steps: true } }, requestedByUser: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return pending.filter((request) => {
      const currentStep = request.workflow.steps.find((s) => s.stepOrder === request.currentStepOrder);
      return currentStep && userRoleIds.has(currentStep.approverRoleId);
    });
  }

  async create(companyId: string, requestedBy: string, dto: CreateApprovalRequestDto) {
    const workflow = await this.prisma.approvalWorkflow.findFirst({ where: { id: dto.workflowId, companyId } });
    if (!workflow) throw new NotFoundException('Approval workflow not found.');
    if (!workflow.isActive) {
      throw new UnprocessableEntityException('This approval workflow is not active.');
    }

    return this.prisma.approvalRequest.create({
      data: {
        companyId,
        workflowId: dto.workflowId,
        title: dto.title,
        description: dto.description,
        amount: dto.amount,
        requestedBy,
        status: 'pending',
        currentStepOrder: 1,
      },
    });
  }

  /**
   * Verifies the actor holds the CURRENT step's approver role
   * (never trusting anything else) before recording the decision.
   * Advancing to the next step, or finalizing as 'approved' on the
   * last step, happens atomically with recording the action.
   */
  async approve(companyId: string, requestId: string, actorId: string, dto: ApprovalActionDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findFirst({
        where: { id: requestId, companyId },
        include: { workflow: { include: { steps: true } } },
      });
      if (!request) throw new NotFoundException('Approval request not found.');
      if (request.status !== 'pending') {
        throw new UnprocessableEntityException(`Cannot act on a request that is already "${request.status}".`);
      }

      const currentStep = request.workflow.steps.find((s) => s.stepOrder === request.currentStepOrder);
      if (!currentStep) {
        throw new UnprocessableEntityException('This request has no valid current step — the workflow may have been edited after this request was created.');
      }

      // Checks for an UNSCOPED grant specifically (matches the exact
      // pre-existing behavior from before scoped roles existed —
      // this check predates that feature). A role scoped to e.g. one
      // department is deliberately NOT sufficient to approve a
      // request here; whether it should be is an open design
      // question this fix does not decide, since approval steps can
      // gate financial actions and silently widening who can approve
      // them is exactly the kind of change to avoid without an
      // explicit decision.
      const hasRole = await tx.userRole.findUnique({
        where: { userId_roleId_scopeId: { userId: actorId, roleId: currentStep.approverRoleId, scopeId: COMPANY_WIDE_SCOPE_ID } },
      });
      if (!hasRole) {
        throw new ForbiddenException('You do not hold the role required to approve this request at its current step.');
      }

      await tx.approvalAction.create({
        data: { requestId, stepOrder: request.currentStepOrder, actorId, decision: 'approved', comments: dto.comments },
      });

      const maxStepOrder = Math.max(...request.workflow.steps.map((s) => s.stepOrder));
      const isLastStep = request.currentStepOrder === maxStepOrder;

      return tx.approvalRequest.update({
        where: { id: requestId },
        data: isLastStep ? { status: 'approved' } : { currentStepOrder: request.currentStepOrder + 1 },
      });
    });
  }

  /** Rejection at ANY step ends the request immediately — there is no "reject just this step and continue". */
  async reject(companyId: string, requestId: string, actorId: string, dto: ApprovalActionDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findFirst({
        where: { id: requestId, companyId },
        include: { workflow: { include: { steps: true } } },
      });
      if (!request) throw new NotFoundException('Approval request not found.');
      if (request.status !== 'pending') {
        throw new UnprocessableEntityException(`Cannot act on a request that is already "${request.status}".`);
      }

      const currentStep = request.workflow.steps.find((s) => s.stepOrder === request.currentStepOrder);
      if (!currentStep) {
        throw new UnprocessableEntityException('This request has no valid current step — the workflow may have been edited after this request was created.');
      }

      // Same unscoped-only check as the approve() path above — see its comment.
      const hasRole = await tx.userRole.findUnique({
        where: { userId_roleId_scopeId: { userId: actorId, roleId: currentStep.approverRoleId, scopeId: COMPANY_WIDE_SCOPE_ID } },
      });
      if (!hasRole) {
        throw new ForbiddenException('You do not hold the role required to reject this request at its current step.');
      }

      await tx.approvalAction.create({
        data: { requestId, stepOrder: request.currentStepOrder, actorId, decision: 'rejected', comments: dto.comments },
      });

      return tx.approvalRequest.update({ where: { id: requestId }, data: { status: 'rejected' } });
    });
  }

  /** Only the requester may withdraw their own pending request. */
  async cancel(companyId: string, requestId: string, requestedBy: string) {
    const request = await this.findOne(companyId, requestId);
    if (request.requestedBy !== requestedBy) {
      throw new ForbiddenException('You can only cancel your own approval requests.');
    }
    if (request.status !== 'pending') {
      throw new UnprocessableEntityException(`Cannot cancel a request that is already "${request.status}".`);
    }
    return this.prisma.approvalRequest.update({ where: { id: requestId }, data: { status: 'cancelled' } });
  }
}
