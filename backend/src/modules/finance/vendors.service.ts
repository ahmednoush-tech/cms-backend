import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, dto: CreateVendorDto) {
    const existing = await this.prisma.vendor.findUnique({
      where: { companyId_vendorCode: { companyId, vendorCode: dto.vendorCode } },
    });
    if (existing) {
      throw new ConflictException(`A vendor with code '${dto.vendorCode}' already exists.`);
    }
    return this.prisma.vendor.create({ data: { companyId, ...dto } });
  }

  async findAll(companyId: string, query: PaginationQueryDto & { status?: string }) {
    const { page, pageSize, search, sortBy, sortDir, status } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { vendorCode: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vendor.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'name']: sortDir ?? 'asc' },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!vendor) throw new NotFoundException('Vendor not found.');
    return vendor;
  }

  async update(companyId: string, id: string, dto: UpdateVendorDto) {
    await this.findOne(companyId, id);
    return this.prisma.vendor.update({ where: { id }, data: dto });
  }

  async softDelete(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const billCount = await this.prisma.bill.count({ where: { vendorId: id, deletedAt: null } });
    if (billCount > 0) {
      throw new UnprocessableEntityException('Cannot delete a vendor that has bills recorded against it. Deactivate it instead.');
    }
    return this.prisma.vendor.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
