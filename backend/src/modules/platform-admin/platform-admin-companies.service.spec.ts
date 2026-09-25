import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PlatformAdminCompaniesService } from './platform-admin-companies.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PlatformAdminCompaniesService', () => {
  let service: PlatformAdminCompaniesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { company: { findMany: jest.fn(), findFirst: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [PlatformAdminCompaniesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(PlatformAdminCompaniesService);
  });

  describe('listCompanies', () => {
    it('excludes soft-deleted companies', async () => {
      prisma.company.findMany.mockResolvedValue([]);
      await service.listCompanies();
      const call = prisma.company.findMany.mock.calls[0][0];
      expect(call.where.deletedAt).toBeNull();
    });

    it('orders by newest company first', async () => {
      prisma.company.findMany.mockResolvedValue([]);
      await service.listCompanies();
      const call = prisma.company.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('flattens the Prisma _count aggregate into plain userCount/employeeCount/customerCount fields', async () => {
      prisma.company.findMany.mockResolvedValue([
        {
          id: 'company-1',
          name: 'Arkan',
          status: 'active',
          createdAt: new Date('2026-01-01'),
          _count: { users: 5, employees: 3, customers: 12 },
        },
      ]);

      const result = await service.listCompanies();

      expect(result).toEqual([
        {
          id: 'company-1',
          name: 'Arkan',
          status: 'active',
          createdAt: new Date('2026-01-01'),
          userCount: 5,
          employeeCount: 3,
          customerCount: 12,
        },
      ]);
    });

    it('returns an empty array (not an error) when there are no companies at all', async () => {
      prisma.company.findMany.mockResolvedValue([]);
      await expect(service.listCompanies()).resolves.toEqual([]);
    });
  });

  describe('getCompanyDetail', () => {
    it('404s when the company does not exist or is soft-deleted', async () => {
      prisma.company.findFirst.mockResolvedValue(null);
      await expect(service.getCompanyDetail('company-1')).rejects.toThrow(NotFoundException);
    });

    it('nests all usage counts under a single "usage" object, not flattened at the top level', async () => {
      prisma.company.findFirst.mockResolvedValue({
        id: 'company-1',
        name: 'Arkan',
        legalName: 'Arkan Integrated Systems Co.',
        email: 'info@arkan-sys.com',
        status: 'active',
        createdAt: new Date('2026-01-01'),
        _count: { users: 5, employees: 3, customers: 12, leads: 20, opportunities: 8, invoices: 40, projects: 4 },
      });

      const result = await service.getCompanyDetail('company-1');

      expect(result.usage).toEqual({
        userCount: 5,
        employeeCount: 3,
        customerCount: 12,
        leadCount: 20,
        opportunityCount: 8,
        invoiceCount: 40,
        projectCount: 4,
      });
      expect('_count' in result).toBe(false);
    });

    it('excludes soft-deleted companies from detail lookup too', async () => {
      prisma.company.findFirst.mockResolvedValue(null);
      await expect(service.getCompanyDetail('company-1')).rejects.toThrow(NotFoundException);
      const call = prisma.company.findFirst.mock.calls[0][0];
      expect(call.where.deletedAt).toBeNull();
      expect(call.where.id).toBe('company-1');
    });
  });
});
