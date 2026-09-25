import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePerformanceCycleDto, UpdatePerformanceCycleDto } from './dto/performance-cycle.dto';

@Injectable()
export class PerformanceCyclesService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.performanceCycle.findMany({ where: { companyId }, orderBy: { startDate: 'desc' } });
  }

  async findOne(companyId: string, id: string) {
    const cycle = await this.prisma.performanceCycle.findFirst({ where: { id, companyId } });
    if (!cycle) throw new NotFoundException('Performance cycle not found.');
    return cycle;
  }

  create(companyId: string, dto: CreatePerformanceCycleDto) {
    return this.prisma.performanceCycle.create({
      data: { companyId, name: dto.name, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) },
    });
  }

  async update(companyId: string, id: string, dto: UpdatePerformanceCycleDto) {
    await this.findOne(companyId, id);
    return this.prisma.performanceCycle.update({ where: { id }, data: dto });
  }
}
