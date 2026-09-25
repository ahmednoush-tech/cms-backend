import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.warehouse.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  async findOne(companyId: string, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id, companyId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found.');
    return warehouse;
  }

  create(companyId: string, dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: { companyId, name: dto.name, address: dto.address } });
  }

  async update(companyId: string, id: string, dto: UpdateWarehouseDto) {
    await this.findOne(companyId, id);
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }
}
