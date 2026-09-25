import { Test } from '@nestjs/testing';
import { FinanceSettingsService } from './finance-settings.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('FinanceSettingsService', () => {
  let service: FinanceSettingsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      financeSettings: { findUnique: jest.fn(), upsert: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [FinanceSettingsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(FinanceSettingsService);
  });

  describe('get', () => {
    it('returns the stored row when settings already exist', async () => {
      prisma.financeSettings.findUnique.mockResolvedValue({ companyId: 'company-1', defaultCashAccountId: 'acc-1' });

      const result = await service.get('company-1');
      expect(result.defaultCashAccountId).toBe('acc-1');
    });

    it('never 404s — returns a row of nulls when a company has not configured Finance yet', async () => {
      prisma.financeSettings.findUnique.mockResolvedValue(null);

      const result = await service.get('company-1');

      expect(result.companyId).toBe('company-1');
      expect(result.defaultCashAccountId).toBeNull();
      expect(result.sellerName).toBeNull();
      expect(result.vatRegistrationNumber).toBeNull();
    });
  });

  describe('update', () => {
    it('upserts — creating the row if this is the first configuration', async () => {
      prisma.financeSettings.upsert.mockResolvedValue({ companyId: 'company-1', defaultCashAccountId: 'acc-1' });

      await service.update('company-1', { defaultCashAccountId: 'acc-1' } as any);

      expect(prisma.financeSettings.upsert).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
        create: { companyId: 'company-1', defaultCashAccountId: 'acc-1' },
        update: { defaultCashAccountId: 'acc-1' },
      });
    });
  });
});
