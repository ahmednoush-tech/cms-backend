import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicesService } from './invoices.service';
import { CreateRecurringInvoiceTemplateDto } from './dto/create-recurring-invoice-template.dto';
import { UpdateRecurringInvoiceTemplateDto } from './dto/update-recurring-invoice-template.dto';

/**
 * Calendar-aware — NOT a naive "add 30 days" or "add 1 to the
 * month index and hope". Verified against real edge cases:
 *   - Jan 31 + 1 month  -> Feb 28 (or Feb 29 in a leap year),
 *     never "Mar 3" (what naive Date arithmetic gives you when
 *     the target month doesn't have a 31st).
 *   - Dec 31 + 1 month  -> Jan 31 of the NEXT year.
 */
function addPeriod(date: Date, frequency: string): Date {
  const monthsToAdd = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12;
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const targetMonthIndex = month + monthsToAdd;

  const naive = new Date(year, targetMonthIndex, day);
  const expectedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;

  if (naive.getMonth() !== expectedMonthIndex) {
    return new Date(year, targetMonthIndex + 1, 0);
  }
  return naive;
}

@Injectable()
export class RecurringInvoiceTemplatesService {
  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateRecurringInvoiceTemplateDto) {
    const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, companyId, deletedAt: null } });
    if (!customer) throw new NotFoundException('Customer not found.');

    const currencyCode = (dto.currencyCode ?? 'SAR').toUpperCase();
    let exchangeRateToBase = 1;
    if (currencyCode !== 'SAR') {
      const currency = await this.prisma.currency.findFirst({ where: { code: currencyCode, isActive: true } });
      if (!currency) throw new UnprocessableEntityException(`Unknown or inactive currency code: ${currencyCode}`);
      if (!dto.exchangeRateToBase || dto.exchangeRateToBase <= 0) {
        throw new UnprocessableEntityException('exchangeRateToBase is required and must be greater than 0 for a non-SAR currency.');
      }
      exchangeRateToBase = dto.exchangeRateToBase;
    }

    const startDate = new Date(dto.startDate);
    if (dto.endDate && new Date(dto.endDate) < startDate) {
      throw new UnprocessableEntityException('endDate cannot be before startDate.');
    }

    return this.prisma.recurringInvoiceTemplate.create({
      data: {
        companyId,
        customerId: dto.customerId,
        name: dto.name,
        currencyCode,
        exchangeRateToBase,
        frequency: dto.frequency,
        startDate,
        nextGenerationDate: startDate,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes,
        createdBy: actorUserId,
        items: { create: dto.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount ?? 0, tax: i.tax ?? 0 })) },
      },
      include: { items: true },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.recurringInvoiceTemplate.findMany({
      where: { companyId },
      include: { customer: { select: { id: true, companyName: true, customerCode: true } } },
      orderBy: { nextGenerationDate: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const template = await this.prisma.recurringInvoiceTemplate.findFirst({
      where: { id, companyId },
      include: { items: true, customer: true, generatedInvoices: { orderBy: { issueDate: 'desc' } } },
    });
    if (!template) throw new NotFoundException('Recurring invoice template not found.');
    return template;
  }

  async update(companyId: string, id: string, dto: UpdateRecurringInvoiceTemplateDto) {
    await this.findOne(companyId, id);

    if (dto.items) {
      await this.prisma.recurringInvoiceTemplateItem.deleteMany({ where: { templateId: id } });
    }

    return this.prisma.recurringInvoiceTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes,
        items: dto.items
          ? { create: dto.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount ?? 0, tax: i.tax ?? 0 })) }
          : undefined,
      },
    });
  }

  async pause(companyId: string, id: string) {
    const template = await this.findOne(companyId, id);
    if (template.status !== 'active') {
      throw new UnprocessableEntityException(`Only an active template can be paused (currently '${template.status}').`);
    }
    return this.prisma.recurringInvoiceTemplate.update({ where: { id }, data: { status: 'paused' } });
  }

  async resume(companyId: string, id: string) {
    const template = await this.findOne(companyId, id);
    if (template.status !== 'paused') {
      throw new UnprocessableEntityException(`Only a paused template can be resumed (currently '${template.status}').`);
    }
    return this.prisma.recurringInvoiceTemplate.update({ where: { id }, data: { status: 'active' } });
  }

  async cancel(companyId: string, id: string) {
    const template = await this.findOne(companyId, id);
    if (!['active', 'paused'].includes(template.status)) {
      throw new UnprocessableEntityException(`A template in '${template.status}' status cannot be cancelled.`);
    }
    return this.prisma.recurringInvoiceTemplate.update({ where: { id }, data: { status: 'cancelled' } });
  }

  /**
   * The on-demand "run now" action — see migration 065's comment
   * for why this is not a real cron job. Every DUE, ACTIVE
   * template (nextGenerationDate <= today) gets exactly one new
   * invoice, generated via InvoicesService.create() itself rather
   * than duplicating its currency/totals logic.
   *
   * One template failing does NOT abort the run for every other
   * due template — it's recorded in `skipped`, by template name,
   * and the run continues.
   */
  async generateDue(companyId: string, actorUserId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueTemplates = await this.prisma.recurringInvoiceTemplate.findMany({
      where: { companyId, status: 'active', nextGenerationDate: { lte: today } },
      include: { items: true },
    });

    const generated: Array<{ templateName: string; invoiceId: string; invoiceNumber: string }> = [];
    const skipped: string[] = [];

    for (const template of dueTemplates) {
      try {
        const invoice = await this.invoicesService.create(companyId, actorUserId, {
          customerId: template.customerId,
          issueDate: template.nextGenerationDate.toISOString().slice(0, 10),
          currencyCode: template.currencyCode,
          exchangeRateToBase: Number(template.exchangeRateToBase),
          items: template.items.map((i) => ({
            description: i.description,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
            discount: Number(i.discount),
            tax: Number(i.tax),
          })),
        });

        await this.prisma.invoice.update({ where: { id: invoice.id }, data: { recurringTemplateId: template.id } });

        const nextDate = addPeriod(template.nextGenerationDate, template.frequency);
        const isPastEnd = template.endDate ? nextDate > template.endDate : false;

        await this.prisma.recurringInvoiceTemplate.update({
          where: { id: template.id },
          data: {
            nextGenerationDate: nextDate,
            status: isPastEnd ? 'completed' : undefined,
          },
        });

        generated.push({ templateName: template.name, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        skipped.push(`${template.name} (${message})`);
      }
    }

    return { generatedCount: generated.length, generated, skipped };
  }
}
