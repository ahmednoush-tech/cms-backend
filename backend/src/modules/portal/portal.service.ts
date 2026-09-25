import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialReportsService } from '../finance/financial-reports.service';

/**
 * Every method here takes companyId AND customerId — customerId
 * comes from the JWT (via @CurrentUser('customerId') in the
 * controller), never from a client-supplied parameter. A portal
 * user only ever sees their OWN customer record's data, and never
 * a status the customer shouldn't see yet: a 'draft' quotation or
 * invoice is deliberately excluded everywhere in this service —
 * it may contain pricing that hasn't been finalized for them.
 *
 * Every field list below is an explicit `select`, not a bare
 * `include`, so that if InvoiceItem/QuotationItem/Project ever
 * grow an internal-only field, it does not silently start
 * flowing to the portal.
 */
@Injectable()
export class PortalService {
  constructor(
    private prisma: PrismaService,
    private financialReportsService: FinancialReportsService,
  ) {}

  async getQuotations(companyId: string, customerId: string) {
    return this.prisma.quotation.findMany({
      where: { companyId, customerId, deletedAt: null, status: { not: 'draft' } },
      select: {
        id: true,
        quotationNumber: true,
        status: true,
        subtotal: true,
        discount: true,
        tax: true,
        total: true,
        validUntil: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuotationDetail(companyId: string, customerId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, companyId, customerId, deletedAt: null, status: { not: 'draft' } },
      select: {
        id: true,
        quotationNumber: true,
        status: true,
        subtotal: true,
        discount: true,
        tax: true,
        total: true,
        validUntil: true,
        createdAt: true,
        items: {
          select: { id: true, description: true, quantity: true, unitPrice: true, discount: true, tax: true, total: true },
        },
      },
    });
    if (!quotation) throw new NotFoundException('Quotation not found.');
    return quotation;
  }

  async getInvoices(companyId: string, customerId: string) {
    return this.prisma.invoice.findMany({
      where: { companyId, customerId, deletedAt: null, status: { not: 'draft' } },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        issueDate: true,
        dueDate: true,
        subtotal: true,
        discount: true,
        tax: true,
        total: true,
        amountPaid: true,
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  async getInvoiceDetail(companyId: string, customerId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId, customerId, deletedAt: null, status: { not: 'draft' } },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        issueDate: true,
        dueDate: true,
        subtotal: true,
        discount: true,
        tax: true,
        total: true,
        amountPaid: true,
        items: {
          select: { id: true, description: true, quantity: true, unitPrice: true, discount: true, tax: true, total: true },
        },
        payments: {
          select: { id: true, amount: true, paymentDate: true, method: true },
          orderBy: { paymentDate: 'asc' },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return invoice;
  }

  async getProjects(companyId: string, customerId: string) {
    return this.prisma.project.findMany({
      where: { companyId, customerId, deletedAt: null },
      select: {
        id: true,
        projectNumber: true,
        name: true,
        description: true,
        status: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Reuses the SAME report FinancialReportsService already builds
   * for internal staff — the only difference is customerId is
   * forced from the JWT rather than accepted as a query parameter,
   * so a portal user can never pass a different customer's ID and
   * see someone else's ledger.
   */
  async getStatement(companyId: string, customerId: string, fromDate: Date, toDate: Date) {
    return this.financialReportsService.customerStatement(companyId, customerId, fromDate, toDate);
  }
}
