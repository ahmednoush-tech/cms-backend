import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CustomersService } from '../customers/customers.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { CreateCustomerUserDto, LinkExistingUserDto } from './dto/customer-user.dto';

/**
 * ACTIVITY LOGGING (Phase 2F P2 fix): customer_users, like
 * customer_contacts, is not in activity_logs.entity_type's CHECK
 * list — mutations here are logged under entityType: 'customer'
 * with entityId: customerId, same pattern as customer-contacts.
 * No schema change.
 */
@Injectable()
export class CustomerUsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private customersService: CustomersService,
    private activityLog: ActivityLogService,
  ) {}

  /** Creates a brand-new portal login and links it to the customer. */
  async createPortalUser(
    companyId: string,
    actorUserId: string,
    customerId: string,
    dto: CreateCustomerUserDto,
  ) {
    await this.customersService.assertCustomerBelongsToCompany(companyId, customerId);
    if (dto.contactId) {
      await this.assertContactBelongsToCustomer(customerId, dto.contactId);
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const passwordHash = await this.authService.hashPassword(dto.password);

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { companyId, name: dto.name, email: dto.email, passwordHash },
        });
        return tx.customerUser.create({
          data: { companyId, customerId, userId: user.id, contactId: dto.contactId },
          include: { user: { select: { id: true, name: true, email: true, status: true } } },
        });
      });
    } catch (err) {
      throw this.translatePrismaError(err);
    }

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'portal_user_created',
      entityType: 'customer',
      entityId: customerId,
      newValues: { customerUserId: created.id, userId: created.userId },
    });

    return created;
  }

  /** Links an already-existing users row to a customer instead of creating a new one. */
  async linkExistingUser(companyId: string, actorUserId: string, customerId: string, dto: LinkExistingUserDto) {
    await this.customersService.assertCustomerBelongsToCompany(companyId, customerId);
    if (dto.contactId) {
      await this.assertContactBelongsToCustomer(customerId, dto.contactId);
    }

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, companyId, deletedAt: null },
    });
    if (!user) {
      throw new BadRequestException('userId must reference an active user in the same company.');
    }

    let created;
    try {
      created = await this.prisma.customerUser.create({
        data: { companyId, customerId, userId: dto.userId, contactId: dto.contactId },
        include: { user: { select: { id: true, name: true, email: true, status: true } } },
      });
    } catch (err) {
      throw this.translatePrismaError(err);
    }

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'portal_user_linked',
      entityType: 'customer',
      entityId: customerId,
      newValues: { customerUserId: created.id, userId: created.userId },
    });

    return created;
  }

  async findAll(companyId: string, customerId: string) {
    await this.customersService.assertCustomerBelongsToCompany(companyId, customerId);
    return this.prisma.customerUser.findMany({
      where: { customerId, deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true, status: true } }, contact: true },
    });
  }

  async revoke(companyId: string, actorUserId: string, customerId: string, customerUserId: string) {
    await this.customersService.assertCustomerBelongsToCompany(companyId, customerId);
    const link = await this.prisma.customerUser.findFirst({
      where: { id: customerUserId, customerId, deletedAt: null },
    });
    if (!link) throw new NotFoundException('Customer portal access record not found.');

    const revoked = await this.prisma.customerUser.update({
      where: { id: customerUserId },
      data: { deletedAt: new Date(), status: 'inactive' },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'portal_user_revoked',
      entityType: 'customer',
      entityId: customerId,
      oldValues: { customerUserId: link.id, userId: link.userId, status: link.status },
      newValues: { customerUserId: revoked.id, status: revoked.status },
    });

    return revoked;
  }

  private async assertContactBelongsToCustomer(customerId: string, contactId: string) {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
    });
    if (!contact) {
      throw new BadRequestException('contactId must belong to the same customer.');
    }
  }

  private translatePrismaError(err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new ConflictException(
        'This user already has portal access to this customer.',
      );
    }
    return err;
  }
}
