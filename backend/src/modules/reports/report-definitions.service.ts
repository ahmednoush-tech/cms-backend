import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { REPORTS_REGISTRY } from './reports-registry';
import { CreateReportDefinitionDto, UpdateReportDefinitionDto, ReportFilterDto } from './dto/report-definition.dto';

@Injectable()
export class ReportDefinitionsService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.reportDefinition.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: 'asc' } });
  }

  async findOne(companyId: string, id: string) {
    const def = await this.prisma.reportDefinition.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!def) throw new NotFoundException('Report definition not found.');
    return def;
  }

  /**
   * THE mandatory checkpoint before anything from a create/update
   * request is ever persisted — every field name involved is
   * checked against REPORTS_REGISTRY (the single source of truth,
   * see that file's comment). Shared between create() and update()
   * so there is exactly one place this validation lives.
   */
  private validateAgainstRegistry(
    entityType: string,
    groupByField: string,
    aggregateType: 'count' | 'sum',
    aggregateField: string | undefined,
    filters: ReportFilterDto[],
  ) {
    const config = REPORTS_REGISTRY[entityType];
    if (!config) {
      throw new UnprocessableEntityException(`"${entityType}" is not a reportable entity.`);
    }

    if (!config.groupByFields.some((f) => f.field === groupByField)) {
      throw new UnprocessableEntityException(`"${groupByField}" is not a valid group-by field for "${entityType}".`);
    }

    if (aggregateType === 'sum') {
      if (!aggregateField) {
        throw new UnprocessableEntityException('aggregateField is required when aggregateType is "sum".');
      }
      if (!config.sumFields.some((f) => f.field === aggregateField)) {
        throw new UnprocessableEntityException(`"${aggregateField}" is not a valid sum field for "${entityType}".`);
      }
    } else if (aggregateField) {
      throw new UnprocessableEntityException('aggregateField must not be set when aggregateType is "count".');
    }

    for (const filter of filters) {
      if (!config.filterFields.some((f) => f.field === filter.field)) {
        throw new UnprocessableEntityException(`"${filter.field}" is not a valid filter field for "${entityType}".`);
      }
    }

    return config;
  }

  async create(companyId: string, userId: string, dto: CreateReportDefinitionDto) {
    this.validateAgainstRegistry(dto.entityType, dto.groupByField, dto.aggregateType, dto.aggregateField, dto.filters ?? []);

    return this.prisma.reportDefinition.create({
      data: {
        companyId,
        name: dto.name,
        entityType: dto.entityType,
        groupByField: dto.groupByField,
        aggregateType: dto.aggregateType,
        aggregateField: dto.aggregateField,
        chartType: dto.chartType ?? 'bar',
        filters: (dto.filters ?? []) as object,
        createdBy: userId,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateReportDefinitionDto) {
    const existing = await this.findOne(companyId, id);

    const merged = {
      entityType: dto.entityType ?? existing.entityType,
      groupByField: dto.groupByField ?? existing.groupByField,
      aggregateType: (dto.aggregateType ?? existing.aggregateType) as 'count' | 'sum',
      aggregateField: dto.aggregateField ?? existing.aggregateField ?? undefined,
      filters: (dto.filters ?? (existing.filters as unknown as ReportFilterDto[])) ?? [],
    };
    this.validateAgainstRegistry(merged.entityType, merged.groupByField, merged.aggregateType, merged.aggregateField, merged.filters);

    return this.prisma.reportDefinition.update({
      where: { id },
      data: {
        name: dto.name,
        entityType: dto.entityType,
        groupByField: dto.groupByField,
        aggregateType: dto.aggregateType,
        aggregateField: dto.aggregateField,
        chartType: dto.chartType,
        filters: dto.filters ? (dto.filters as object) : undefined,
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.reportDefinition.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
