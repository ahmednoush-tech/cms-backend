import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import {
  LEAD_TRANSITIONS,
  WorkflowTransitionValidator,
} from '../../common/services/workflow-transition.validator';
import {
  ConvertLeadDto,
  CreateLeadDto,
  UpdateLeadDto,
  UpdateLeadStatusDto,
} from './dto/lead.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';
import { AutomationRuleEngineService } from '../automation-rules/automation-rule-engine.service';
import { CustomFieldValidationService } from '../custom-fields/custom-field-validation.service';

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private automationRuleEngine: AutomationRuleEngineService,
    private customFieldValidation: CustomFieldValidationService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateLeadDto) {
    const customFields = await this.customFieldValidation.validateAndNormalize(companyId, 'lead', dto.customFields);

    const lead = await this.prisma.lead.create({
      data: {
        companyId,
        name: dto.name,
        companyName: dto.companyName,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        notes: dto.notes,
        ownerId: dto.ownerId ?? actorUserId,
        customFields: customFields as Prisma.InputJsonValue,
      },
    });

    await this.automationRuleEngine.onLeadCreated(companyId, { id: lead.id, name: lead.name, ownerId: lead.ownerId });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'created',
      entityType: 'lead',
      entityId: lead.id,
      newValues: lead,
    });

    return lead;
  }

  async findAll(companyId: string, query: PaginationQueryDto) {
    const { page, pageSize, search, sortBy, sortDir } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { companyName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'createdAt']: sortDir },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found.');
    return lead;
  }

  /**
   * customFields validation now merges internally (see
   * CustomFieldValidationService's own comment) — a required
   * field already missing on this lead from BEFORE this update,
   * and not part of THIS request, no longer blocks an otherwise
   * unrelated update. Passing dto.customFields and
   * before.customFields SEPARATELY (not pre-merged) is what makes
   * that distinction possible.
   */
  async update(companyId: string, actorUserId: string, id: string, dto: UpdateLeadDto) {
    const before = await this.findOne(companyId, id);

    let customFields: Record<string, unknown> | undefined;
    if (dto.customFields !== undefined) {
      customFields = await this.customFieldValidation.validateAndNormalize(
        companyId,
        'lead',
        dto.customFields,
        before.customFields as Record<string, unknown>,
      );
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        name: dto.name,
        companyName: dto.companyName,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        notes: dto.notes,
        ownerId: dto.ownerId,
        ...(customFields !== undefined ? { customFields: customFields as Prisma.InputJsonValue } : {}),
      },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'updated',
      entityType: 'lead',
      entityId: id,
      oldValues: before,
      newValues: updated,
    });

    return updated;
  }

  async updateStatus(
    companyId: string,
    actorUserId: string,
    id: string,
    dto: UpdateLeadStatusDto,
  ) {
    const before = await this.findOne(companyId, id);

    WorkflowTransitionValidator.assertValidTransition(
      'lead',
      LEAD_TRANSITIONS,
      before.status,
      dto.status,
    );

    const updated = await this.prisma.lead.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'status_changed',
      entityType: 'lead',
      entityId: id,
      oldValues: { status: before.status },
      newValues: { status: updated.status },
    });

    return updated;
  }

  async softDelete(companyId: string, actorUserId: string, id: string) {
    const before = await this.findOne(companyId, id);
    const deleted = await this.prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'deleted',
      entityType: 'lead',
      entityId: id,
      oldValues: before,
    });

    return deleted;
  }

  /**
   * Lead -> Convert -> Customer + Contact -> optional Opportunity.
   *
   * Conversion is only allowed from 'qualified', 'proposal', or
   * 'won' (approved rule) — 'new'/'contacted'/'lost' are rejected.
   * The lead row is NEVER deleted — customerId/convertedAt/
   * convertedBy are populated on it, preserving full history.
   *
   * Duplicate-customer safeguard: unless existingCustomerId is
   * explicitly supplied, the service tries to match an existing
   * customer in the same company before creating a new one:
   *   1. exact email match (case-insensitive), then
   *   2. exact company-name match for 'company'-type customers
   *      (case-insensitive).
   * Only when neither matches is a new customer created, and only
   * then are customerType/customerCode required.
   *
   * Everything — match/create customer, match/create contact,
   * optional opportunity, lead field update — runs inside one
   * `$transaction`, so a failure at any step rolls back all of it.
   *
   * Idempotency: a lead that is already converted returns 409
   * immediately, before the transaction opens, and creates
   * nothing — calling convert() twice never produces a second
   * customer/contact/opportunity.
   */
  async convert(companyId: string, actorUserId: string, id: string, dto: ConvertLeadDto) {
    const lead = await this.findOne(companyId, id);

    if (lead.customerId || lead.convertedAt) {
      throw new ConflictException(
        `This lead was already converted to customer ${lead.customerId}.`,
      );
    }
    if (!['qualified', 'proposal', 'won'].includes(lead.status)) {
      throw new BadRequestException(
        `Lead must be in 'qualified', 'proposal', or 'won' status to convert (currently '${lead.status}').`,
      );
    }
    if (dto.createOpportunity && !dto.opportunityName) {
      throw new BadRequestException('opportunityName is required when createOpportunity is true.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // ---- 1 & 2 & 5: resolve or create the customer ----
      let customerId: string;
      let customerWasCreated = false;

      if (dto.existingCustomerId) {
        const existing = await tx.customer.findFirst({
          where: { id: dto.existingCustomerId, companyId, deletedAt: null },
        });
        if (!existing) {
          throw new BadRequestException(
            'existingCustomerId must reference an active customer in the same company.',
          );
        }
        customerId = existing.id;
      } else {
        const matched = await this.findMatchingCustomer(tx, companyId, lead, dto);
        if (matched) {
          customerId = matched.id;
        } else {
          if (!dto.customerType || !dto.customerCode) {
            throw new BadRequestException(
              'No matching existing customer was found — provide both customerType and customerCode to create a new one (or set existingCustomerId explicitly).',
            );
          }
          const created = await tx.customer.create({
            data: {
              companyId,
              customerType: dto.customerType,
              companyName: dto.companyName ?? lead.companyName,
              customerCode: dto.customerCode,
              email: lead.email,
              phone: lead.phone,
              ownerId: lead.ownerId ?? actorUserId,
            },
          });
          customerId = created.id;
          customerWasCreated = true;
        }
      }

      // ---- 3: set on the lead (applied below, kept here as the resolved value) ----

      // ---- 4: create the contact only if one doesn't already exist ----
      let contact = null;
      let contactWasCreated = false;
      if (dto.createContact !== false) {
        contact = lead.email
          ? await tx.customerContact.findFirst({
              where: { customerId, email: { equals: lead.email, mode: 'insensitive' } },
            })
          : null;

        if (!contact) {
          contact = await tx.customerContact.create({
            data: {
              customerId,
              name: lead.name,
              email: lead.email,
              phone: lead.phone,
              isPrimary: true,
            },
          });
          contactWasCreated = true;
        }
      }

      // ---- optional opportunity ----
      let opportunity = null;
      if (dto.createOpportunity) {
        opportunity = await tx.opportunity.create({
          data: {
            companyId,
            customerId,
            leadId: lead.id,
            name: dto.opportunityName!,
            ownerId: lead.ownerId ?? actorUserId,
          },
        });
      }

      // ---- lead conversion fields ----
      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          customerId,
          convertedAt: new Date(),
          convertedBy: actorUserId,
          status: 'won',
        },
      });

      return {
        lead: updatedLead,
        customerId,
        customerWasCreated,
        contact,
        contactWasCreated,
        opportunity,
      };
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'converted',
      entityType: 'lead',
      entityId: id,
      oldValues: { status: lead.status, customerId: lead.customerId },
      newValues: {
        status: 'won',
        customerId: result.customerId,
        customerWasCreated: result.customerWasCreated,
      },
    });
    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: result.customerWasCreated ? 'created_from_lead_conversion' : 'matched_from_lead_conversion',
      entityType: 'customer',
      entityId: result.customerId,
      newValues: { convertedFromLeadId: id },
    });

    return result;
  }

  /**
   * Duplicate-customer matching: email first (most reliable, and
   * matches how convert() re-uses an existing contact too), then
   * company name for 'company'-type customers. Both comparisons
   * are case-insensitive and scoped to companyId + not-deleted.
   * Returns null if nothing matches — the caller then requires
   * customerType/customerCode to create a new one.
   */
  private async findMatchingCustomer(
    tx: Prisma.TransactionClient,
    companyId: string,
    lead: { email: string | null; companyName: string | null },
    dto: ConvertLeadDto,
  ) {
    if (lead.email) {
      const byEmail = await tx.customer.findFirst({
        where: { companyId, deletedAt: null, email: { equals: lead.email, mode: 'insensitive' } },
      });
      if (byEmail) return byEmail;
    }

    const companyNameToMatch = dto.companyName ?? lead.companyName;
    if (companyNameToMatch) {
      const byName = await tx.customer.findFirst({
        where: {
          companyId,
          deletedAt: null,
          customerType: 'company',
          companyName: { equals: companyNameToMatch, mode: 'insensitive' },
        },
      });
      if (byName) return byName;
    }

    return null;
  }
}
