import { Test } from '@nestjs/testing';
import { CustomerDuplicateDetectionService } from './customer-duplicate-detection.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CustomerDuplicateDetectionService', () => {
  let service: CustomerDuplicateDetectionService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { customer: { findMany: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [CustomerDuplicateDetectionService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(CustomerDuplicateDetectionService);
  });

  it('returns an empty array (no query at all) when no field is provided', async () => {
    const result = await service.checkForDuplicates('company-1', {});
    expect(result).toEqual([]);
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
  });

  describe('email matching', () => {
    it('matches case-insensitively', async () => {
      prisma.customer.findMany.mockResolvedValueOnce([
        { id: 'cust-1', companyName: 'Acme', email: 'Info@Acme.com', phone: null, customerCode: 'C-001' },
      ]);

      const result = await service.checkForDuplicates('company-1', { email: 'info@acme.com' });

      expect(result).toHaveLength(1);
      expect(result[0].matchedOn).toEqual(['email']);
    });

    it('scopes the query to the caller company and excludes soft-deleted rows', async () => {
      prisma.customer.findMany.mockResolvedValueOnce([]);
      await service.checkForDuplicates('company-1', { email: 'info@acme.com' });
      const call = prisma.customer.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-1');
      expect(call.where.deletedAt).toBeNull();
    });

    it('excludes the given excludeId (for update-time checks)', async () => {
      prisma.customer.findMany.mockResolvedValueOnce([]);
      await service.checkForDuplicates('company-1', { email: 'info@acme.com', excludeId: 'cust-self' });
      const call = prisma.customer.findMany.mock.calls[0][0];
      expect(call.where.id).toEqual({ not: 'cust-self' });
    });
  });

  describe('companyName matching', () => {
    it('the service never flags an approximate match as a real match — its own comparison requires exact equality even if a query bug ever returned a near-miss row', async () => {
      prisma.customer.findMany.mockResolvedValueOnce([
        { id: 'cust-1', companyName: 'Acme Corporation', email: null, phone: null, customerCode: 'C-001' },
      ]);

      const result = await service.checkForDuplicates('company-1', { companyName: 'Acme Corp' });

      expect(result[0].matchedOn).toEqual([]);
    });

    it('flags a true exact case-insensitive match', async () => {
      prisma.customer.findMany.mockResolvedValueOnce([
        { id: 'cust-1', companyName: 'ACME CORP', email: null, phone: null, customerCode: 'C-001' },
      ]);

      const result = await service.checkForDuplicates('company-1', { companyName: 'acme corp' });

      expect(result[0].matchedOn).toEqual(['companyName']);
    });
  });

  describe('phone matching', () => {
    it('matches after stripping all non-digit formatting characters', async () => {
      prisma.customer.findMany.mockResolvedValueOnce([
        { id: 'cust-1', companyName: 'Acme', email: null, phone: '+966 50-123-4567', customerCode: 'C-001' },
      ]);

      const result = await service.checkForDuplicates('company-1', { phone: '0966501234567' });

      expect(result[0].matchedOn).toEqual(['phone']);
    });

    it('does not match when the digit strings genuinely differ', async () => {
      prisma.customer.findMany.mockResolvedValueOnce([
        { id: 'cust-1', companyName: 'Acme', email: null, phone: '0501111111', customerCode: 'C-001' },
      ]);

      const result = await service.checkForDuplicates('company-1', { phone: '0502222222' });

      expect(result).toHaveLength(0);
    });

    it('never matches a customer with no phone on file', async () => {
      prisma.customer.findMany.mockResolvedValueOnce([]);
      await service.checkForDuplicates('company-1', { phone: '0501234567' });
      const call = prisma.customer.findMany.mock.calls[0][0];
      expect(call.where.phone).toEqual({ not: null });
    });
  });

  describe('combining multiple matched fields on the same candidate', () => {
    it('lists ALL matched reasons (email AND phone) for a single candidate, not just one', async () => {
      prisma.customer.findMany
        .mockResolvedValueOnce([{ id: 'cust-1', companyName: 'Acme', email: 'info@acme.com', phone: '0501234567', customerCode: 'C-001' }])
        .mockResolvedValueOnce([{ id: 'cust-1', companyName: 'Acme', email: 'info@acme.com', phone: '0501234567', customerCode: 'C-001' }]);

      const result = await service.checkForDuplicates('company-1', { email: 'info@acme.com', phone: '0501234567' });

      expect(result).toHaveLength(1);
      expect(result[0].matchedOn.sort()).toEqual(['email', 'phone']);
    });

    it('deduplicates a candidate returned by both the email/companyName query and the phone query into ONE result', async () => {
      prisma.customer.findMany
        .mockResolvedValueOnce([{ id: 'cust-1', companyName: 'Acme', email: 'info@acme.com', phone: '0501234567', customerCode: 'C-001' }])
        .mockResolvedValueOnce([{ id: 'cust-1', companyName: 'Acme', email: 'info@acme.com', phone: '0501234567', customerCode: 'C-001' }]);

      const result = await service.checkForDuplicates('company-1', { email: 'info@acme.com', phone: '0501234567' });

      expect(result.filter((r) => r.id === 'cust-1')).toHaveLength(1);
    });
  });
});
