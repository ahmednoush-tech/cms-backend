import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PublicQuotationService } from './public-quotation.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PublicQuotationService', () => {
  let service: PublicQuotationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { quotation: { findFirst: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [PublicQuotationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(PublicQuotationService);
  });

  it('404s when no quotation matches the token', async () => {
    prisma.quotation.findFirst.mockResolvedValue(null);

    await expect(service.getByToken('00000000-0000-0000-0000-000000000000')).rejects.toThrow(NotFoundException);
  });

  it('excludes draft quotations from the lookup, even with a valid token', async () => {
    prisma.quotation.findFirst.mockResolvedValue(null);

    await service.getByToken('token-for-a-draft').catch(() => {});

    const call = prisma.quotation.findFirst.mock.calls[0][0];
    expect(call.where.status).toEqual({ not: 'draft' });
  });

  it('looks up by publicToken only — never by the internal sequential id', async () => {
    prisma.quotation.findFirst.mockResolvedValue({ quotationNumber: 'QT-2026-0001', company: { id: 'company-1', logo: null } });

    await service.getByToken('some-token-value');

    const call = prisma.quotation.findFirst.mock.calls[0][0];
    expect(call.where.publicToken).toBe('some-token-value');
    expect(call.where.id).toBeUndefined();
  });

  it('never selects internal-only identifiers (companyId, createdBy, id)', async () => {
    prisma.quotation.findFirst.mockResolvedValue({ quotationNumber: 'QT-2026-0001', company: { id: 'company-1', logo: null } });

    await service.getByToken('some-token-value');

    const call = prisma.quotation.findFirst.mock.calls[0][0];
    const selectedKeys = Object.keys(call.select);
    expect(selectedKeys).not.toContain('id');
    expect(selectedKeys).not.toContain('companyId');
    expect(selectedKeys).not.toContain('createdBy');
    expect(selectedKeys).not.toContain('publicToken');
  });

  it("rewrites the company's logo to the stable public serving path, never the raw storage key", async () => {
    prisma.quotation.findFirst.mockResolvedValue({
      quotationNumber: 'QT-2026-0001',
      company: { id: 'company-1', logo: 'logos/company-1-abc.png' },
    });

    const result = await service.getByToken('some-token-value');

    expect(result.company.logo).toBe('/api/v1/public/company-info/company-1/logo');
  });
});
