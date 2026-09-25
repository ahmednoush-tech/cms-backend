import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { CreateCustomerContactDto, UpdateCustomerContactDto } from './dto/customer-contact.dto';

/**
 * customer_contacts has no company_id column of its own (per the
 * approved schema) — tenant scoping is enforced by first
 * resolving the parent customer through CustomersService, which
 * already filters by companyId. Every method here takes
 * customerId explicitly and re-validates it belongs to the
 * caller's company before touching any contact row.
 *
 * Also note: customer_contacts has no deleted_at column (it's
 * owned entirely by its soft-deletable customer parent), so
 * removal here is a real delete, not a soft delete.
 *
 * ACTIVITY LOGGING (Phase 2F P2 fix): customer_contacts is not
 * itself in activity_logs.entity_type's CHECK list (only
 * customer, lead, opportunity, quotation, project, work_order,
 * task, employee, user, role are). Contact mutations are
 * therefore logged under entityType: 'customer' with
 * entityId: customerId — the exact same pattern already used
 * for quotation_items (logged under 'quotation') and
 * project_members (logged under 'project'). No schema change.
 */
@Injectable()
export class CustomerContactsService {
  constructor(
    private prisma: PrismaService,
    private customersService: CustomersService,
    private activityLog: ActivityLogService,
  ) {}

  async create(companyId: string, actorUserId: string, customerId: string, dto: CreateCustomerContactDto) {
    await this.customersService.assertCustomerBelongsToCompany(companyId, customerId);

    if (dto.isPrimary) {
      await this.clearExistingPrimary(customerId);
    }

    const contact = await this.prisma.customerContact.create({
      data: {
        customerId,
        name: dto.name,
        jobTitle: dto.jobTitle,
        email: dto.email,
        phone: dto.phone,
        isPrimary: dto.isPrimary ?? false,
      },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'contact_added',
      entityType: 'customer',
      entityId: customerId,
      newValues: contact,
    });

    return contact;
  }

  async findAll(companyId: string, customerId: string) {
    await this.customersService.assertCustomerBelongsToCompany(companyId, customerId);
    return this.prisma.customerContact.findMany({
      where: { customerId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(companyId: string, customerId: string, contactId: string) {
    await this.customersService.assertCustomerBelongsToCompany(companyId, customerId);
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
    });
    if (!contact) throw new NotFoundException('Contact not found.');
    return contact;
  }

  async update(
    companyId: string,
    actorUserId: string,
    customerId: string,
    contactId: string,
    dto: UpdateCustomerContactDto,
  ) {
    const before = await this.findOne(companyId, customerId, contactId); // tenant + existence check
    if (dto.isPrimary) {
      await this.clearExistingPrimary(customerId, contactId);
    }
    const updated = await this.prisma.customerContact.update({ where: { id: contactId }, data: dto });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'contact_updated',
      entityType: 'customer',
      entityId: customerId,
      oldValues: before,
      newValues: updated,
    });

    return updated;
  }

  async remove(companyId: string, actorUserId: string, customerId: string, contactId: string) {
    const before = await this.findOne(companyId, customerId, contactId);
    const deleted = await this.prisma.customerContact.delete({ where: { id: contactId } });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'contact_removed',
      entityType: 'customer',
      entityId: customerId,
      oldValues: before,
    });

    return deleted;
  }

  private async clearExistingPrimary(customerId: string, exceptContactId?: string) {
    await this.prisma.customerContact.updateMany({
      where: {
        customerId,
        isPrimary: true,
        ...(exceptContactId ? { id: { not: exceptContactId } } : {}),
      },
      data: { isPrimary: false },
    });
  }
}
