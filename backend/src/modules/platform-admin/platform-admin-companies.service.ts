import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { enableRlsBypass } from '../../prisma/rls-bypass.util';

/**
 * SCOPE: company VISIBILITY only — name, status, signup date, and
 * basic usage counts as a rough activity proxy. NOT a
 * subscription/billing system — there is no plan, no payment
 * status, no invoicing of these companies themselves.
 */
@Injectable()
export class PlatformAdminCompaniesService {
  constructor(private prisma: PrismaService) {}

  async listCompanies() {
    await enableRlsBypass();

    const companies = await this.prisma.company.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true, employees: true, customers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      createdAt: c.createdAt,
      userCount: c._count.users,
      employeeCount: c._count.employees,
      customerCount: c._count.customers,
    }));
  }

  async getCompanyDetail(id: string) {
    await enableRlsBypass();

    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        legalName: true,
        email: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            employees: true,
            customers: true,
            leads: true,
            opportunities: true,
            invoices: true,
            projects: true,
          },
        },
      },
    });

    if (!company) throw new NotFoundException('Company not found.');

    return {
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      email: company.email,
      status: company.status,
      createdAt: company.createdAt,
      usage: {
        userCount: company._count.users,
        employeeCount: company._count.employees,
        customerCount: company._count.customers,
        leadCount: company._count.leads,
        opportunityCount: company._count.opportunities,
        invoiceCount: company._count.invoices,
        projectCount: company._count.projects,
      },
    };
  }
}
