import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePerformanceCriterionDto, UpdatePerformanceCriterionDto } from './dto/performance-criterion.dto';

@Injectable()
export class PerformanceCriteriaService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.performanceCriterion.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: 'asc' } });
  }

  async findOne(companyId: string, id: string) {
    const criterion = await this.prisma.performanceCriterion.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!criterion) throw new NotFoundException('Performance criterion not found.');
    return criterion;
  }

  create(companyId: string, dto: CreatePerformanceCriterionDto) {
    return this.prisma.performanceCriterion.create({ data: { companyId, name: dto.name, description: dto.description } });
  }

  async update(companyId: string, id: string, dto: UpdatePerformanceCriterionDto) {
    await this.findOne(companyId, id);
    return this.prisma.performanceCriterion.update({ where: { id }, data: dto });
  }

  /** Soft-delete only — a criterion referenced by past evaluation_scores must remain readable in that historical context (see migration 087's comment). */
  async deactivate(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.performanceCriterion.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
