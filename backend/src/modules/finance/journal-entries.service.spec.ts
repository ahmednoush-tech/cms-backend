import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { JournalEntriesService } from './journal-entries.service';
import { PeriodLockService } from './period-lock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('JournalEntriesService', () => {
  let service: JournalEntriesService;
  let prisma: any;
  let periodLock: { assertDateNotLocked: jest.Mock };

  function mockTransaction(prismaMock: any) {
    return jest.fn((arg) => {
      if (typeof arg === 'function') return arg(prismaMock);
      return Promise.all(arg);
    });
  }

  beforeEach(async () => {
    prisma = {
      journalEntry: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      journalEntryLine: {
        deleteMany: jest.fn(),
      },
      account: {
        count: jest.fn(),
      },
    };
    prisma.$transaction = mockTransaction(prisma);

    periodLock = { assertDateNotLocked: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        JournalEntriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PeriodLockService, useValue: periodLock },
      ],
    }).compile();

    service = moduleRef.get(JournalEntriesService);
  });

  describe('create', () => {
    it('rejects an unbalanced entry before ever touching the database', async () => {
      await expect(
        service.create('company-1', 'user-1', {
          entryDate: '2026-06-01',
          lines: [
            { accountId: 'acc-1', debit: 100, credit: 0 },
            { accountId: 'acc-2', debit: 0, credit: 90 },
          ],
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.account.count).not.toHaveBeenCalled();
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('rejects when a referenced account does not belong to the caller company', async () => {
      prisma.account.count.mockResolvedValue(1);

      await expect(
        service.create('company-1', 'user-1', {
          entryDate: '2026-06-01',
          lines: [
            { accountId: 'acc-1', debit: 100, credit: 0 },
            { accountId: 'acc-2', debit: 0, credit: 100 },
          ],
        } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('creates a balanced entry as a draft, without checking the period lock', async () => {
      prisma.account.count.mockResolvedValue(2);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1', entryNumber: 'JE-2026-0001', status: 'draft' });

      const result = await service.create('company-1', 'user-1', {
        entryDate: '2026-06-01',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 },
        ],
      } as any);

      expect(result.status).toBe('draft');
      expect(prisma.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'draft', companyId: 'company-1' }) }),
      );
      expect(periodLock.assertDateNotLocked).not.toHaveBeenCalled();
    });
  });

  describe('post', () => {
    it("checks the period lock using the entry's own entryDate before posting", async () => {
      const entryDate = new Date('2026-01-15');
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'je-1', status: 'draft', entryDate, lines: [] });
      prisma.journalEntry.update.mockResolvedValue({ id: 'je-1', status: 'posted' });

      await service.post('company-1', 'je-1');

      expect(periodLock.assertDateNotLocked).toHaveBeenCalledWith('company-1', entryDate);
    });

    it('propagates the period-lock rejection and never posts when the period is locked', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'je-1', status: 'draft', entryDate: new Date('2026-01-15'), lines: [] });
      periodLock.assertDateNotLocked.mockRejectedValue(new UnprocessableEntityException('locked'));

      await expect(service.post('company-1', 'je-1')).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.journalEntry.update).not.toHaveBeenCalled();
    });

    it('rejects posting an already-posted entry', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'je-1', status: 'posted', entryDate: new Date(), lines: [] });

      await expect(service.post('company-1', 'je-1')).rejects.toThrow(ForbiddenException);
      expect(periodLock.assertDateNotLocked).not.toHaveBeenCalled();
    });
  });

  describe('update / softDelete — posted-entry immutability', () => {
    it('rejects updating a posted entry', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'je-1', status: 'posted', lines: [] });

      await expect(service.update('company-1', 'je-1', { description: 'edited' } as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects deleting a posted entry', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'je-1', status: 'posted', lines: [] });

      await expect(service.softDelete('company-1', 'je-1')).rejects.toThrow(ForbiddenException);
    });

    it('allows updating a draft entry', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'je-1', status: 'draft', lines: [] });
      prisma.journalEntry.update.mockResolvedValue({ id: 'je-1', status: 'draft' });

      await expect(service.update('company-1', 'je-1', { description: 'edited' } as any)).resolves.toBeDefined();
    });
  });

  describe('void', () => {
    it('rejects voiding a draft entry (only posted entries can be voided)', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'je-1', status: 'draft', lines: [] });

      await expect(service.void('company-1', 'je-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('allows voiding a posted entry', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'je-1', status: 'posted', lines: [] });
      prisma.journalEntry.update.mockResolvedValue({ id: 'je-1', status: 'void' });

      const result = await service.void('company-1', 'je-1');
      expect(result.status).toBe('void');
    });
  });
});
