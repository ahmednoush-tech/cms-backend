import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      account: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      journalEntryLine: { count: jest.fn() },
    };
    prisma.$transaction = jest.fn((arg) => Promise.all(arg));

    const moduleRef = await Test.createTestingModule({
      providers: [AccountsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AccountsService);
  });

  describe('create', () => {
    it('rejects a duplicate account code within the same company', async () => {
      prisma.account.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('company-1', { code: '1000', name: 'Cash', type: 'asset', normalBalance: 'debit' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a parentId that does not belong to the caller company', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.create('company-1', {
          code: '1100',
          name: 'Petty Cash',
          type: 'asset',
          normalBalance: 'debit',
          parentId: 'not-mine',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates the account when the code is unique and the parent (if any) is valid', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      prisma.account.findFirst.mockResolvedValue({ id: 'parent-1' });
      prisma.account.create.mockResolvedValue({ id: 'acc-1', code: '1100' });

      const result = await service.create('company-1', {
        code: '1100',
        name: 'Petty Cash',
        type: 'asset',
        normalBalance: 'debit',
        parentId: 'parent-1',
      } as any);

      expect(result.code).toBe('1100');
    });
  });

  describe('findOne', () => {
    it('404s when the account does not exist in the caller company', async () => {
      prisma.account.findFirst.mockResolvedValue(null);
      await expect(service.findOne('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('rejects deleting an account that has journal entry lines posted against it', async () => {
      prisma.account.findFirst.mockResolvedValue({ id: 'acc-1' });
      prisma.journalEntryLine.count.mockResolvedValue(3);

      await expect(service.softDelete('company-1', 'acc-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects deleting an account that has active child accounts', async () => {
      prisma.account.findFirst.mockResolvedValue({ id: 'acc-1' });
      prisma.journalEntryLine.count.mockResolvedValue(0);
      prisma.account.count.mockResolvedValue(2);

      await expect(service.softDelete('company-1', 'acc-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('allows deleting a leaf account with no lines and no children', async () => {
      prisma.account.findFirst.mockResolvedValue({ id: 'acc-1' });
      prisma.journalEntryLine.count.mockResolvedValue(0);
      prisma.account.count.mockResolvedValue(0);
      prisma.account.update.mockResolvedValue({ id: 'acc-1', deletedAt: new Date() });

      await expect(service.softDelete('company-1', 'acc-1')).resolves.toBeDefined();
    });
  });
});
