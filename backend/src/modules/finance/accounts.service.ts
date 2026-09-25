import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, dto: CreateAccountDto) {
    const existing = await this.prisma.account.findUnique({
      where: { companyId_code: { companyId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`An account with code '${dto.code}' already exists.`);
    }

    if (dto.parentId) {
      await this.assertParentBelongsToCompany(companyId, dto.parentId);
    }

    return this.prisma.account.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        normalBalance: dto.normalBalance,
        parentId: dto.parentId,
        description: dto.description,
      },
    });
  }

  async findAll(companyId: string, query: PaginationQueryDto & { type?: string }) {
    const { page, pageSize, search, sortBy, sortDir, type } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { code: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'code']: sortDir ?? 'asc' },
      }),
      this.prisma.account.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { parent: true, children: { where: { deletedAt: null } } },
    });
    if (!account) throw new NotFoundException('Account not found.');
    return account;
  }

  async update(companyId: string, id: string, dto: UpdateAccountDto) {
    await this.findOne(companyId, id);
    return this.prisma.account.update({ where: { id }, data: dto });
  }

  async softDelete(companyId: string, id: string) {
    await this.findOne(companyId, id);

    const lineCount = await this.prisma.journalEntryLine.count({ where: { accountId: id } });
    if (lineCount > 0) {
      throw new UnprocessableEntityException(
        'Cannot delete an account that has journal entry lines posted against it. Deactivate it instead.',
      );
    }

    const childCount = await this.prisma.account.count({ where: { parentId: id, deletedAt: null } });
    if (childCount > 0) {
      throw new UnprocessableEntityException('Cannot delete an account that has active child accounts.');
    }

    return this.prisma.account.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async assertParentBelongsToCompany(companyId: string, parentId: string) {
    const parent = await this.prisma.account.findFirst({ where: { id: parentId, companyId, deletedAt: null } });
    if (!parent) {
      throw new BadRequestException('parentId must reference an existing account in the same company.');
    }
  }
}
