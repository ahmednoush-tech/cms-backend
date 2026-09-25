import { Test } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RecurringInvoiceTemplatesService } from '../finance/recurring-invoice-templates.service';
import { EmployeeDocumentsService } from '../employees/employee-documents.service';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let prisma: any;
  let recurringInvoiceTemplatesService: { generateDue: jest.Mock };
  let employeeDocumentsService: { checkExpiringIqamas: jest.Mock };

  beforeEach(async () => {
    prisma = {
      company: { findMany: jest.fn() },
      user: { findFirst: jest.fn() },
      revokedRefreshToken: { deleteMany: jest.fn() },
      startRequestTransaction: jest.fn((fn: any) => fn({ $executeRaw: jest.fn() })),
    };
    recurringInvoiceTemplatesService = { generateDue: jest.fn() };
    employeeDocumentsService = { checkExpiringIqamas: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: PrismaService, useValue: prisma },
        { provide: RecurringInvoiceTemplatesService, useValue: recurringInvoiceTemplatesService },
        { provide: EmployeeDocumentsService, useValue: employeeDocumentsService },
      ],
    }).compile();

    service = moduleRef.get(SchedulerService);
  });

  describe('runDailyRecurringInvoiceGeneration', () => {
    it('does nothing (no transactions opened for per-company work) when there are no active companies', async () => {
      prisma.company.findMany.mockResolvedValue([]);

      await service.runDailyRecurringInvoiceGeneration();

      expect(recurringInvoiceTemplatesService.generateDue).not.toHaveBeenCalled();
    });

    it("calls generateDue for each active company, using that company's earliest active user as the actor", async () => {
      prisma.company.findMany.mockResolvedValue([{ id: 'company-1' }, { id: 'company-2' }]);
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'user-1' }).mockResolvedValueOnce({ id: 'user-2' });
      recurringInvoiceTemplatesService.generateDue.mockResolvedValue({ generatedCount: 2, generated: [], skipped: [] });

      await service.runDailyRecurringInvoiceGeneration();

      expect(recurringInvoiceTemplatesService.generateDue).toHaveBeenCalledWith('company-1', 'user-1');
      expect(recurringInvoiceTemplatesService.generateDue).toHaveBeenCalledWith('company-2', 'user-2');
    });

    it('skips a company with no active user at all, without throwing, and still processes the next company', async () => {
      prisma.company.findMany.mockResolvedValue([{ id: 'company-1' }, { id: 'company-2' }]);
      prisma.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'user-2' });
      recurringInvoiceTemplatesService.generateDue.mockResolvedValue({ generatedCount: 0, generated: [], skipped: [] });

      await service.runDailyRecurringInvoiceGeneration();

      expect(recurringInvoiceTemplatesService.generateDue).toHaveBeenCalledTimes(1);
      expect(recurringInvoiceTemplatesService.generateDue).toHaveBeenCalledWith('company-2', 'user-2');
    });

    it("one company's failure does not stop the next company from being processed", async () => {
      prisma.company.findMany.mockResolvedValue([{ id: 'company-1' }, { id: 'company-2' }]);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-x' });
      recurringInvoiceTemplatesService.generateDue
        .mockRejectedValueOnce(new Error('boom for company-1'))
        .mockResolvedValueOnce({ generatedCount: 1, generated: [], skipped: [] });

      await expect(service.runDailyRecurringInvoiceGeneration()).resolves.toBeUndefined();

      expect(recurringInvoiceTemplatesService.generateDue).toHaveBeenCalledTimes(2);
    });

    it('sets app.current_company_id to THIS company inside its own transaction, not a shared/global one', async () => {
      prisma.company.findMany.mockResolvedValue([{ id: 'company-1' }]);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      recurringInvoiceTemplatesService.generateDue.mockResolvedValue({ generatedCount: 0, generated: [], skipped: [] });

      const executeRawMock = jest.fn();
      prisma.startRequestTransaction
        .mockImplementationOnce((fn: any) => fn({ $executeRaw: jest.fn() }))
        .mockImplementationOnce((fn: any) => fn({ $executeRaw: executeRawMock }));

      await service.runDailyRecurringInvoiceGeneration();

      expect(executeRawMock).toHaveBeenCalled();
    });
  });

  describe('runDailyIqamaExpiryCheck', () => {
    it('calls checkExpiringIqamas for every active company', async () => {
      prisma.company.findMany.mockResolvedValue([{ id: 'company-1' }, { id: 'company-2' }]);
      employeeDocumentsService.checkExpiringIqamas.mockResolvedValue({ expiringCount: 0, notificationsSent: 0, employees: [] });

      await service.runDailyIqamaExpiryCheck();

      expect(employeeDocumentsService.checkExpiringIqamas).toHaveBeenCalledWith('company-1');
      expect(employeeDocumentsService.checkExpiringIqamas).toHaveBeenCalledWith('company-2');
    });

    it("one company's failure does not stop the Iqama check for the next company", async () => {
      prisma.company.findMany.mockResolvedValue([{ id: 'company-1' }, { id: 'company-2' }]);
      employeeDocumentsService.checkExpiringIqamas
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ expiringCount: 1, notificationsSent: 1, employees: [] });

      await expect(service.runDailyIqamaExpiryCheck()).resolves.toBeUndefined();

      expect(employeeDocumentsService.checkExpiringIqamas).toHaveBeenCalledTimes(2);
    });
  });

  describe('getActiveCompanyIds (via the public methods)', () => {
    it('only ever queries companies with status active and not soft-deleted', async () => {
      prisma.company.findMany.mockResolvedValue([]);
      await service.runDailyIqamaExpiryCheck();

      const call = prisma.company.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('active');
      expect(call.where.deletedAt).toBeNull();
    });
  });

  describe('cleanupExpiredRevokedTokens', () => {
    it('deletes only rows whose expiry is in the past — no per-company transaction dance, since this table has no company_id', async () => {
      prisma.revokedRefreshToken.deleteMany.mockResolvedValue({ count: 3 });

      await service.cleanupExpiredRevokedTokens();

      const call = prisma.revokedRefreshToken.deleteMany.mock.calls[0][0];
      expect(call.where.expiresAt.lt).toBeInstanceOf(Date);
      expect(prisma.company.findMany).not.toHaveBeenCalled();
    });
  });
});
