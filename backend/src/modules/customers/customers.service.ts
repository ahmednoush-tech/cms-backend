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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';
import { CustomFieldValidationService } from '../custom-fields/custom-field-validation.service';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private customFieldValidation: CustomFieldValidationService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateCustomerDto) {
    if (dto.ownerId) {
      await this.assertUserBelongsToCompany(companyId, dto.ownerId);
    }
    const customFields = await this.customFieldValidation.validateAndNormalize(companyId, 'customer', dto.customFields);

    try {
      const customer = await this.prisma.customer.create({
        data: {
          companyId,
          customerType: dto.customerType,
          companyName: dto.companyName,
          customerCode: dto.customerCode,
          email: dto.email,
          phone: dto.phone,
          website: dto.website,
          address: dto.address,
          city: dto.city,
          country: dto.country,
          vatRegistrationNumber: dto.vatRegistrationNumber,
          ownerId: dto.ownerId ?? actorUserId,
          customFields: customFields as Prisma.InputJsonValue,
        },
      });

      await this.activityLog.record({
        companyId,
        userId: actorUserId,
        action: 'created',
        entityType: 'customer',
        entityId: customer.id,
        newValues: customer,
      });

      return customer;
    } catch (err) {
      throw this.translatePrismaError(err);
    }
  }

  async findAll(companyId: string, query: PaginationQueryDto) {
    const { page, pageSize, search, sortBy, sortDir } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: 'insensitive' as const } },
              { customerCode: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'createdAt']: sortDir },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { contacts: true },
    });
    if (!customer) throw new NotFoundException('Customer not found.');
    return customer;
  }

  /**
   * customFields validation now merges internally (see
   * CustomFieldValidationService's own comment) — passing
   * dto.customFields and before.customFields SEPARATELY (not
   * pre-merged) lets a required field already missing from BEFORE
   * this update, and not part of THIS request, avoid blocking an
   * otherwise unrelated update.
   */
  async update(companyId: string, actorUserId: string, id: string, dto: UpdateCustomerDto) {
    const before = await this.findOne(companyId, id);
    if (dto.ownerId) {
      await this.assertUserBelongsToCompany(companyId, dto.ownerId);
    }

    let customFields: Record<string, unknown> | undefined;
    if (dto.customFields !== undefined) {
      customFields = await this.customFieldValidation.validateAndNormalize(
        companyId,
        'customer',
        dto.customFields,
        before.customFields as Record<string, unknown>,
      );
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        companyName: dto.companyName,
        email: dto.email,
        phone: dto.phone,
        website: dto.website,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        vatRegistrationNumber: dto.vatRegistrationNumber,
        status: dto.status,
        ownerId: dto.ownerId,
        ...(customFields !== undefined ? { customFields: customFields as Prisma.InputJsonValue } : {}),
      },
    });

    const action = dto.status && dto.status !== before.status ? 'status_changed' : 'updated';
    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action,
      entityType: 'customer',
      entityId: id,
      oldValues: before,
      newValues: updated,
    });

    return updated;
  }

  /**
   * P2 FIX (V1 Final System Audit §9): a customer with active
   * projects can no longer be soft-deleted. "Active" is defined
   * exactly as specified: planning, approved, in_progress, on_hold.
   * completed/cancelled projects do NOT block deletion — they're
   * finished business, not open work. Mirrors the same pattern
   * already used by DepartmentsService (blocks on active
   * employees) and ProjectsService (status-gated self-delete).
   */
  async softDelete(companyId: string, actorUserId: string, id: string) {
    const before = await this.findOne(companyId, id);

    const activeProjectCount = await this.prisma.project.count({
      where: {
        customerId: id,
        companyId,
        deletedAt: null,
        status: { in: ['planning', 'approved', 'in_progress', 'on_hold'] },
      },
    });
    if (activeProjectCount > 0) {
      throw new UnprocessableEntityException(
        `Cannot delete this customer — ${activeProjectCount} active project(s) (planning/approved/in_progress/on_hold) ` +
          `still reference it. Complete or cancel them first.`,
      );
    }

    const deleted = await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'inactive' },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'deleted',
      entityType: 'customer',
      entityId: id,
      oldValues: before,
    });

    return deleted;
  }

  /** Used internally by lead conversion and by other services validating a customer reference. */
  async assertCustomerBelongsToCompany(companyId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException('customerId must reference an active customer in the same company.');
    }
    return customer;
  }

  private async assertUserBelongsToCompany(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
    });
    if (!user) {
      throw new BadRequestException('ownerId must reference an active user in the same company.');
    }
  }

  private translatePrismaError(err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new ConflictException('A customer with this customerCode already exists.');
    }
    return err;
  }
}
