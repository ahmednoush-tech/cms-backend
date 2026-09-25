import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ApprovalWorkflowsService } from './approval-workflows.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ApprovalWorkflowsService', () => {
  let service: ApprovalWorkflowsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      approvalWorkflow: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      role: { findMany: jest.fn() },
      approvalWorkflowStep: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ApprovalWorkflowsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ApprovalWorkflowsService);
  });

  describe('create', () => {
    it("rejects a step referencing a role id that doesn't belong to this company", async () => {
      prisma.role.findMany.mockResolvedValue([]);
      const dto = { name: 'Big Purchases', steps: [{ approverRoleId: 'role-from-another-company' }] };

      await expect(service.create('company-1', dto)).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.approvalWorkflow.create).not.toHaveBeenCalled();
    });

    it('assigns stepOrder from array POSITION, 1-indexed, regardless of any order in the input', async () => {
      prisma.role.findMany.mockResolvedValue([{ id: 'role-a' }, { id: 'role-b' }]);
      prisma.approvalWorkflow.create.mockResolvedValue({ id: 'wf-1' });

      const dto = { name: 'Two Step', steps: [{ approverRoleId: 'role-a' }, { approverRoleId: 'role-b' }] };
      await service.create('company-1', dto);

      const call = prisma.approvalWorkflow.create.mock.calls[0][0];
      expect(call.data.steps.create).toEqual([
        { stepOrder: 1, approverRoleId: 'role-a' },
        { stepOrder: 2, approverRoleId: 'role-b' },
      ]);
    });
  });

  describe('update', () => {
    it('404s before attempting to update a workflow from another company', async () => {
      prisma.approvalWorkflow.findFirst.mockResolvedValue(null);
      await expect(service.update('company-1', 'wf-1', { name: 'New Name' })).rejects.toThrow(NotFoundException);
    });

    it('re-validates roles again when steps are replaced on update', async () => {
      prisma.approvalWorkflow.findFirst.mockResolvedValue({ id: 'wf-1' });
      prisma.role.findMany.mockResolvedValue([]);

      await expect(
        service.update('company-1', 'wf-1', { steps: [{ approverRoleId: 'bad-role' }] }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.approvalWorkflowStep.deleteMany).not.toHaveBeenCalled();
    });

    it('leaves steps untouched when the update omits them entirely (e.g. renaming only)', async () => {
      prisma.approvalWorkflow.findFirst.mockResolvedValue({ id: 'wf-1' });
      prisma.approvalWorkflow.update.mockResolvedValue({ id: 'wf-1', name: 'Renamed' });

      await service.update('company-1', 'wf-1', { name: 'Renamed' });

      expect(prisma.approvalWorkflowStep.deleteMany).not.toHaveBeenCalled();
      expect(prisma.approvalWorkflowStep.createMany).not.toHaveBeenCalled();
    });
  });
});
