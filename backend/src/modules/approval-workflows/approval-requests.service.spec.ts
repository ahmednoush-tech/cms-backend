import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ApprovalRequestsService } from './approval-requests.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ApprovalRequestsService', () => {
  let service: ApprovalRequestsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      approvalWorkflow: { findFirst: jest.fn() },
      approvalRequest: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      approvalAction: { create: jest.fn() },
      userRole: { findMany: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ApprovalRequestsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ApprovalRequestsService);
  });

  describe('create', () => {
    it('404s when the workflow does not exist for this company', async () => {
      prisma.approvalWorkflow.findFirst.mockResolvedValue(null);
      await expect(service.create('company-1', 'user-1', { workflowId: 'wf-1', title: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('rejects creating a request against an inactive workflow', async () => {
      prisma.approvalWorkflow.findFirst.mockResolvedValue({ id: 'wf-1', isActive: false });
      await expect(service.create('company-1', 'user-1', { workflowId: 'wf-1', title: 'x' })).rejects.toThrow(UnprocessableEntityException);
    });

    it('creates at step 1, status pending', async () => {
      prisma.approvalWorkflow.findFirst.mockResolvedValue({ id: 'wf-1', isActive: true });
      prisma.approvalRequest.create.mockResolvedValue({ id: 'req-1' });

      await service.create('company-1', 'user-1', { workflowId: 'wf-1', title: 'Buy a laptop' });

      const call = prisma.approvalRequest.create.mock.calls[0][0];
      expect(call.data.status).toBe('pending');
      expect(call.data.currentStepOrder).toBe(1);
      expect(call.data.requestedBy).toBe('user-1');
    });
  });

  describe('approve — the actual security boundary', () => {
    const twoStepRequest = (currentStepOrder: number) => ({
      id: 'req-1',
      status: 'pending',
      currentStepOrder,
      workflow: {
        steps: [
          { stepOrder: 1, approverRoleId: 'role-manager' },
          { stepOrder: 2, approverRoleId: 'role-finance' },
        ],
      },
    });

    it("rejects approval from someone who does NOT hold the current step's required role", async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue(twoStepRequest(1));
      prisma.userRole.findUnique.mockResolvedValue(null);

      await expect(service.approve('company-1', 'req-1', 'random-user', {})).rejects.toThrow(ForbiddenException);
      expect(prisma.approvalAction.create).not.toHaveBeenCalled();
      expect(prisma.approvalRequest.update).not.toHaveBeenCalled();
    });

    it('rejects acting on a request that is already finalized', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue({ ...twoStepRequest(1), status: 'approved' });
      await expect(service.approve('company-1', 'req-1', 'user-1', {})).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.userRole.findUnique).not.toHaveBeenCalled();
    });

    it('advances to the NEXT step (does not finalize) when the current step is not the last one', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue(twoStepRequest(1));
      prisma.userRole.findUnique.mockResolvedValue({ userId: 'manager-1', roleId: 'role-manager' });
      prisma.approvalRequest.update.mockResolvedValue({ id: 'req-1', currentStepOrder: 2 });

      await service.approve('company-1', 'req-1', 'manager-1', { comments: 'looks fine' });

      const updateCall = prisma.approvalRequest.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ currentStepOrder: 2 });
      const actionCall = prisma.approvalAction.create.mock.calls[0][0];
      expect(actionCall.data.stepOrder).toBe(1);
      expect(actionCall.data.decision).toBe('approved');
    });

    it('finalizes as "approved" when the current step IS the last step', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue(twoStepRequest(2));
      prisma.userRole.findUnique.mockResolvedValue({ userId: 'finance-1', roleId: 'role-finance' });
      prisma.approvalRequest.update.mockResolvedValue({ id: 'req-1', status: 'approved' });

      await service.approve('company-1', 'req-1', 'finance-1', {});

      const updateCall = prisma.approvalRequest.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ status: 'approved' });
    });
  });

  describe('reject', () => {
    it('rejection at step 1 of a multi-step workflow ends the request immediately, not just that step', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        currentStepOrder: 1,
        workflow: { steps: [{ stepOrder: 1, approverRoleId: 'role-manager' }, { stepOrder: 2, approverRoleId: 'role-finance' }] },
      });
      prisma.userRole.findUnique.mockResolvedValue({ userId: 'manager-1', roleId: 'role-manager' });
      prisma.approvalRequest.update.mockResolvedValue({ id: 'req-1', status: 'rejected' });

      await service.reject('company-1', 'req-1', 'manager-1', { comments: 'too expensive' });

      const updateCall = prisma.approvalRequest.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ status: 'rejected' });
    });

    it("rejects rejection from someone who does not hold the current step's role", async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        currentStepOrder: 1,
        workflow: { steps: [{ stepOrder: 1, approverRoleId: 'role-manager' }] },
      });
      prisma.userRole.findUnique.mockResolvedValue(null);

      await expect(service.reject('company-1', 'req-1', 'random-user', {})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancel', () => {
    it("rejects cancelling someone else's request", async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        requestedBy: 'original-requester',
        workflow: { steps: [] },
        actions: [],
      });
      await expect(service.cancel('company-1', 'req-1', 'different-user')).rejects.toThrow(ForbiddenException);
    });

    it('rejects cancelling an already-decided request', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        status: 'approved',
        requestedBy: 'user-1',
        workflow: { steps: [] },
        actions: [],
      });
      await expect(service.cancel('company-1', 'req-1', 'user-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('findPendingForUser', () => {
    it('only returns requests whose CURRENT step role the user actually holds', async () => {
      prisma.userRole.findMany.mockResolvedValue([{ roleId: 'role-manager' }]);
      prisma.approvalRequest.findMany.mockResolvedValue([
        { id: 'req-1', currentStepOrder: 1, workflow: { steps: [{ stepOrder: 1, approverRoleId: 'role-manager' }] } },
        { id: 'req-2', currentStepOrder: 1, workflow: { steps: [{ stepOrder: 1, approverRoleId: 'role-finance' }] } },
      ]);

      const result = await service.findPendingForUser('company-1', 'manager-1');

      expect(result.map((r: any) => r.id)).toEqual(['req-1']);
    });
  });
});
