import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { QuotationCalculator } from '../../common/services/quotation-calculator';
import {
  QUOTATION_TERMINAL_STATES,
  QUOTATION_TRANSITIONS,
  WorkflowTransitionValidator,
} from '../../common/services/workflow-transition.validator';
import { CustomersService } from '../customers/customers.service';
import { CreateQuotationDto, UpdateQuotationDto } from './dto/quotation.dto';
import { CreateQuotationItemDto, UpdateQuotationItemDto } from './dto/quotation-item.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';
import { QuotationFiltersDto } from './dto/quotation-filters.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class QuotationsService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private customersService: CustomersService,
    private notifications: NotificationsService,
  ) {}

  // ============================================================
  // CREATE
  // ============================================================

  /**
   * A quotation always belongs to company + customer, optionally
   * to an opportunity. All three tenant/relationship checks (8, 9
   * in the spec) happen here before anything is written.
   */
  async create(companyId: string, actorUserId: string, dto: CreateQuotationDto) {
    await this.customersService.assertCustomerBelongsToCompany(companyId, dto.customerId);

    if (dto.opportunityId) {
      await this.assertOpportunityValidForQuotation(companyId, dto.customerId, dto.opportunityId);
    }

    const { currencyCode, exchangeRateToBase } = await this.resolveCurrency(dto.currencyCode, dto.exchangeRateToBase);

    // Validate item inputs up front (throws 400 before touching
    // the DB) even though we recompute everything again below —
    // fail fast on bad input rather than mid-transaction.
    const items = dto.items ?? [];
    for (const item of items) {
      QuotationCalculator.calculateLine(item);
    }
    const totals = QuotationCalculator.aggregate(
      items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount ?? 0, tax: i.tax ?? 0 })),
    );

    const quotation = await this.prisma.$transaction(async (tx) => {
      const quotationNumber = await this.generateQuotationNumber(tx, companyId);

      const created = await tx.quotation.create({
        data: {
          companyId,
          customerId: dto.customerId,
          opportunityId: dto.opportunityId,
          quotationNumber,
          status: 'draft',
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
          currencyCode,
          exchangeRateToBase,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          createdBy: actorUserId,
        },
      });

      if (items.length) {
        for (const item of items) {
          const line = QuotationCalculator.calculateLine(item);
          await tx.quotationItem.create({
            data: {
              quotationId: created.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: line.discount,
              tax: line.tax,
              total: line.total,
              stockItemId: item.stockItemId,
            },
          });
        }
      }

      return created;
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'created',
      entityType: 'quotation',
      entityId: quotation.id,
      newValues: quotation,
    });

    return this.findOne(companyId, quotation.id);
  }

  // ============================================================
  // READ
  // ============================================================

  async findAll(companyId: string, query: QuotationFiltersDto) {
    const { page, pageSize, search, sortBy, sortDir, customerId, opportunityId, status } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(customerId ? { customerId } : {}),
      ...(opportunityId ? { opportunityId } : {}),
      ...(status ? { status } : {}),
      ...(search ? { quotationNumber: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.quotation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'createdAt']: sortDir },
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  /**
   * Plain read — deliberately does NOT auto-expire overdue
   * quotations as a side effect (per spec: "do not silently
   * modify quotation status during normal GET requests").
   */
  async findOne(companyId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: { orderBy: { createdAt: 'asc' } }, customer: true, opportunity: true },
    });
    if (!quotation) throw new NotFoundException('Quotation not found.');
    return quotation;
  }

  // ============================================================
  // UPDATE (non-item fields)
  // ============================================================

  async update(companyId: string, actorUserId: string, id: string, dto: UpdateQuotationDto) {
    const before = await this.findOne(companyId, id);
    this.assertNotTerminal(before);

    if (before.status === 'sent') {
      // Sent: only a due-date extension is allowed — no commercial change.
      if (dto.customerId || dto.opportunityId) {
        throw new UnprocessableEntityException(
          'A sent quotation cannot have its customer or opportunity changed. Only validUntil may be updated.',
        );
      }
    }

    if (dto.customerId && dto.customerId !== before.customerId) {
      await this.customersService.assertCustomerBelongsToCompany(companyId, dto.customerId);
    }
    if (dto.opportunityId) {
      const customerIdForCheck = dto.customerId ?? before.customerId;
      await this.assertOpportunityValidForQuotation(companyId, customerIdForCheck, dto.opportunityId);
    }

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: {
        customerId: dto.customerId,
        opportunityId: dto.opportunityId,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
    });

    const action =
      dto.customerId && dto.customerId !== before.customerId
        ? 'customer_changed'
        : dto.opportunityId && dto.opportunityId !== before.opportunityId
          ? 'opportunity_changed'
          : 'updated';

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action,
      entityType: 'quotation',
      entityId: id,
      oldValues: before,
      newValues: updated,
    });

    return this.findOne(companyId, id);
  }

  async softDelete(companyId: string, actorUserId: string, id: string) {
    const before = await this.findOne(companyId, id);
    if (before.status !== 'draft') {
      throw new UnprocessableEntityException(
        'Only draft quotations can be deleted. Sent/accepted/rejected/expired quotations must be preserved as history.',
      );
    }

    const deleted = await this.prisma.quotation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'deleted',
      entityType: 'quotation',
      entityId: id,
      oldValues: before,
    });

    return deleted;
  }

  // ============================================================
  // ITEMS
  // ============================================================

  async addItem(companyId: string, actorUserId: string, quotationId: string, dto: CreateQuotationItemDto) {
    const quotation = await this.findOne(companyId, quotationId);
    this.assertDraftForItemMutation(quotation);

    const line = QuotationCalculator.calculateLine(dto);

    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.quotationItem.create({
        data: {
          quotationId,
          description: dto.description,
          quantity: dto.quantity,
          unitPrice: dto.unitPrice,
          discount: line.discount,
          tax: line.tax,
          total: line.total,
          stockItemId: dto.stockItemId,
        },
      });
      await this.recalculateTotals(tx, quotationId);
      return created;
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'item_created',
      entityType: 'quotation',
      entityId: quotationId,
      newValues: item,
    });

    return this.findOne(companyId, quotationId);
  }

  async updateItem(
    companyId: string,
    actorUserId: string,
    quotationId: string,
    itemId: string,
    dto: UpdateQuotationItemDto,
  ) {
    const quotation = await this.findOne(companyId, quotationId);
    this.assertDraftForItemMutation(quotation);

    const existingItem = quotation.items.find((i) => i.id === itemId);
    if (!existingItem) throw new NotFoundException('Quotation item not found.');

    const merged = {
      description: dto.description ?? existingItem.description,
      quantity: dto.quantity ?? Number(existingItem.quantity),
      unitPrice: dto.unitPrice ?? Number(existingItem.unitPrice),
      discount: dto.discount ?? Number(existingItem.discount),
      tax: dto.tax ?? Number(existingItem.tax),
    };
    const line = QuotationCalculator.calculateLine(merged);

    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.quotationItem.update({
        where: { id: itemId },
        data: {
          description: merged.description,
          quantity: merged.quantity,
          unitPrice: merged.unitPrice,
          discount: line.discount,
          tax: line.tax,
          total: line.total,
          stockItemId: dto.stockItemId,
        },
      });
      await this.recalculateTotals(tx, quotationId);
      return item;
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'item_updated',
      entityType: 'quotation',
      entityId: quotationId,
      oldValues: existingItem,
      newValues: updated,
    });

    return this.findOne(companyId, quotationId);
  }

  async removeItem(companyId: string, actorUserId: string, quotationId: string, itemId: string) {
    const quotation = await this.findOne(companyId, quotationId);
    this.assertDraftForItemMutation(quotation);

    const existingItem = quotation.items.find((i) => i.id === itemId);
    if (!existingItem) throw new NotFoundException('Quotation item not found.');

    await this.prisma.$transaction(async (tx) => {
      await tx.quotationItem.delete({ where: { id: itemId } });
      await this.recalculateTotals(tx, quotationId);
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'item_deleted',
      entityType: 'quotation',
      entityId: quotationId,
      oldValues: existingItem,
    });

    return this.findOne(companyId, quotationId);
  }

  // ============================================================
  // LIFECYCLE ACTIONS
  // ============================================================

  /** draft -> sent. Recalculates totals, logs, notifies. */
  async send(companyId: string, actorUserId: string, id: string) {
    const quotation = await this.findOne(companyId, id);

    WorkflowTransitionValidator.assertValidTransition(
      'quotation',
      QUOTATION_TRANSITIONS,
      quotation.status,
      'sent',
    );

    if (quotation.items.length === 0) {
      throw new UnprocessableEntityException('Cannot send a quotation with no line items.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.recalculateTotals(tx, id);
      return tx.quotation.update({ where: { id }, data: { status: 'sent' } });
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'sent',
      entityType: 'quotation',
      entityId: id,
      oldValues: { status: quotation.status },
      newValues: { status: 'sent', total: updated.total },
    });

    await this.notifyStakeholder(companyId, quotation, 'quotation_sent', 'Quotation Sent', `Quotation ${quotation.quotationNumber} has been sent to the customer.`);

    return this.findOne(companyId, id);
  }

  /** sent -> accepted */
  async accept(companyId: string, actorUserId: string, id: string) {
    return this.transitionTerminal(companyId, actorUserId, id, 'accepted', 'quotation_accepted', 'Quotation Accepted');
  }

  /** sent -> rejected */
  async reject(companyId: string, actorUserId: string, id: string) {
    return this.transitionTerminal(companyId, actorUserId, id, 'rejected', 'quotation_rejected', 'Quotation Rejected');
  }

  /**
   * sent -> expired, only when valid_until has actually passed.
   * Explicit action only — never triggered automatically by a
   * scheduler or by a GET request, per spec.
   */
  async expire(companyId: string, actorUserId: string, id: string) {
    const quotation = await this.findOne(companyId, id);

    WorkflowTransitionValidator.assertValidTransition(
      'quotation',
      QUOTATION_TRANSITIONS,
      quotation.status,
      'expired',
    );

    if (!quotation.validUntil || quotation.validUntil > new Date()) {
      throw new UnprocessableEntityException(
        'This quotation is not yet past its validUntil date and cannot be expired.',
      );
    }

    const updated = await this.prisma.quotation.update({ where: { id }, data: { status: 'expired' } });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'expired',
      entityType: 'quotation',
      entityId: id,
      oldValues: { status: quotation.status },
      newValues: { status: 'expired' },
    });

    return this.findOne(companyId, id);
  }

  private async transitionTerminal(
    companyId: string,
    actorUserId: string,
    id: string,
    targetStatus: 'accepted' | 'rejected',
    notificationType: string,
    notificationTitle: string,
  ) {
    const quotation = await this.findOne(companyId, id);

    WorkflowTransitionValidator.assertValidTransition(
      'quotation',
      QUOTATION_TRANSITIONS,
      quotation.status,
      targetStatus,
    );

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: targetStatus },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: targetStatus === 'accepted' ? 'accepted' : 'rejected',
      entityType: 'quotation',
      entityId: id,
      oldValues: { status: quotation.status },
      newValues: { status: targetStatus },
    });

    await this.notifyStakeholder(
      companyId,
      quotation,
      notificationType,
      notificationTitle,
      `Quotation ${quotation.quotationNumber} was ${targetStatus}.`,
    );

    return this.findOne(companyId, id);
  }

  // ============================================================
  // Internals
  // ============================================================

  private assertNotTerminal(quotation: { status: string }) {
    if (QUOTATION_TERMINAL_STATES.includes(quotation.status)) {
      throw new UnprocessableEntityException(
        `Quotation is in a terminal state ('${quotation.status}') and cannot be modified.`,
      );
    }
  }

  private assertDraftForItemMutation(quotation: { status: string }) {
    if (quotation.status !== 'draft') {
      throw new UnprocessableEntityException(
        `Line items can only be added, edited, or removed while a quotation is in 'draft' status (currently '${quotation.status}').`,
      );
    }
  }

  /** Recomputes and persists quotation-level totals from its current items. Must run inside the caller's transaction. */
  private async recalculateTotals(tx: Prisma.TransactionClient, quotationId: string) {
    const items = await tx.quotationItem.findMany({ where: { quotationId } });
    const totals = QuotationCalculator.aggregate(
      items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, tax: i.tax })),
    );
    return tx.quotation.update({
      where: { id: quotationId },
      data: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
      },
    });
  }

  private async assertOpportunityValidForQuotation(
    companyId: string,
    customerId: string,
    opportunityId: string,
  ) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id: opportunityId, companyId, deletedAt: null },
    });
    if (!opportunity) {
      throw new BadRequestException('opportunityId must reference an active opportunity in the same company.');
    }
    if (opportunity.customerId !== customerId) {
      throw new BadRequestException('opportunityId must belong to the same customer as the quotation.');
    }
    if (opportunity.stage === 'lost') {
      throw new BadRequestException('Cannot create a quotation against an opportunity in the "lost" stage.');
    }
  }

  /** Generates a unique-per-company quotation number, retrying on the rare concurrent-collision case. */
  /**
   * Shared by QuotationsService and (via the same logic,
   * duplicated intentionally rather than a cross-module
   * dependency) InvoicesService — validates the currency code is
   * a real, active entry in the currencies table, and normalizes
   * the rate: SAR (the base currency) is ALWAYS rate 1, regardless
   * of what a caller passes, since a base-currency document has no
   * meaningful "exchange rate to itself" to record.
   */
  private async resolveCurrency(
    currencyCode: string | undefined,
    exchangeRateToBase: number | undefined,
  ): Promise<{ currencyCode: string; exchangeRateToBase: number }> {
    const code = (currencyCode ?? 'SAR').toUpperCase();
    if (code === 'SAR') {
      return { currencyCode: 'SAR', exchangeRateToBase: 1 };
    }
    const currency = await this.prisma.currency.findFirst({ where: { code, isActive: true } });
    if (!currency) {
      throw new UnprocessableEntityException(`Unknown or inactive currency code: ${code}`);
    }
    if (!exchangeRateToBase || exchangeRateToBase <= 0) {
      throw new UnprocessableEntityException('exchangeRateToBase is required and must be greater than 0 for a non-SAR currency.');
    }
    return { currencyCode: code, exchangeRateToBase };
  }

  private async generateQuotationNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `QTN-${year}-`;

    const count = await tx.quotation.count({
      where: { companyId, quotationNumber: { startsWith: prefix } },
    });

    let attempt = count + 1;
    for (let tries = 0; tries < 5; tries++) {
      const candidate = `${prefix}${String(attempt).padStart(4, '0')}`;
      const clash = await tx.quotation.findFirst({
        where: { companyId, quotationNumber: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
      attempt++;
    }
    throw new ConflictException('Could not generate a unique quotation number — please retry.');
  }

  private async notifyStakeholder(
    companyId: string,
    quotation: { id: string; customerId: string; createdBy: string | null },
    type: string,
    title: string,
    message: string,
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id: quotation.customerId } });
    const notifyUserId = customer?.ownerId ?? quotation.createdBy;
    if (!notifyUserId) return;

    await this.notifications.create({
      companyId,
      userId: notifyUserId,
      type,
      title,
      message,
      entityType: 'quotation',
      entityId: quotation.id,
    });
  }
}
