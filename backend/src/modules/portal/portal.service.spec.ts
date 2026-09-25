import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialReportsService } from '../finance/financial-reports.service';

describe('PortalService', () => {
  let service: PortalService;
  let prisma: any;
  let financialReportsService: { customerStatement: jest.Mock };

  beforeEach(async () => {
    prisma = {
      quotation: { findMany: jest.fn(), findFirst: jest.fn() },
      invoice: { findMany: jest.fn(), findFirst: jest.fn() },
      project: { findMany: jest.fn() },
    };
    financialReportsService = { customerStatement: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PortalService,
        { provide: PrismaService, useValue: prisma },
        { provide: FinancialReportsService, useValue: financialReportsService },
      ],
    }).compile();

    service = moduleRef.get(PortalService);
  });

  describe('getQuotations', () => {
    it('scopes the query by BOTH companyId and customerId', async () => {
      prisma.quotation.findMany.mockResolvedValue([]);

      await service.getQuotations('company-1', 'cust-1');

      const call = prisma.quotation.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-1');
      expect(call.where.customerId).toBe('cust-1');
    });

    it('always excludes draft quotations', async () => {
      prisma.quotation.findMany.mockResolvedValue([]);

      await service.getQuotations('company-1', 'cust-1');

      const call = prisma.quotation.findMany.mock.calls[0][0];
      expect(call.where.status).toEqual({ not: 'draft' });
    });
  });

  describe('getQuotationDetail', () => {
    it('404s (never leaks existence) when the quotation belongs to a DIFFERENT customer', async () => {
      prisma.quotation.findFirst.mockResolvedValue(null);

      await expect(service.getQuotationDetail('company-1', 'cust-1', 'quote-belonging-to-cust-2')).rejects.toThrow(
        NotFoundException,
      );

      const call = prisma.quotation.findFirst.mock.calls[0][0];
      expect(call.where.customerId).toBe('cust-1');
    });

    it('404s for a draft quotation even if it belongs to the right customer', async () => {
      prisma.quotation.findFirst.mockResolvedValue(null);

      await expect(service.getQuotationDetail('company-1', 'cust-1', 'draft-quote')).rejects.toThrow(NotFoundException);

      const call = prisma.quotation.findFirst.mock.calls[0][0];
      expect(call.where.status).toEqual({ not: 'draft' });
    });
  });

  describe('getInvoices', () => {
    it('scopes the query by BOTH companyId and customerId, excluding drafts', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.getInvoices('company-1', 'cust-1');

      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-1');
      expect(call.where.customerId).toBe('cust-1');
      expect(call.where.status).toEqual({ not: 'draft' });
    });
  });

  describe('getInvoiceDetail', () => {
    it('404s when the invoice belongs to a different customer', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(service.getInvoiceDetail('company-1', 'cust-1', 'invoice-belonging-to-cust-2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('never selects internal-only fields — only whitelisted columns', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });

      await service.getInvoiceDetail('company-1', 'cust-1', 'inv-1');

      const call = prisma.invoice.findFirst.mock.calls[0][0];
      const selectedKeys = Object.keys(call.select);
      expect(selectedKeys).not.toContain('journalEntryId');
      expect(selectedKeys).not.toContain('createdBy');
    });
  });

  describe('getProjects', () => {
    it('scopes the query by BOTH companyId and customerId', async () => {
      prisma.project.findMany.mockResolvedValue([]);

      await service.getProjects('company-1', 'cust-1');

      const call = prisma.project.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-1');
      expect(call.where.customerId).toBe('cust-1');
    });
  });

  describe('getStatement', () => {
    it('forwards to FinancialReportsService.customerStatement with the JWT-derived customerId', async () => {
      financialReportsService.customerStatement.mockResolvedValue({ customerId: 'cust-1' });

      await service.getStatement('company-1', 'cust-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(financialReportsService.customerStatement).toHaveBeenCalledWith(
        'company-1',
        'cust-1',
        new Date('2026-01-01'),
        new Date('2026-12-31'),
      );
    });
  });
});
