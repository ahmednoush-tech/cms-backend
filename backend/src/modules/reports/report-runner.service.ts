import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { REPORTS_REGISTRY, ReportFilter } from './reports-registry';
import { ReportDefinitionsService } from './report-definitions.service';
import { CreateReportDefinitionDto } from './dto/report-definition.dto';

@Injectable()
export class ReportRunnerService {
  constructor(
    private prisma: PrismaService,
    private reportDefinitionsService: ReportDefinitionsService,
  ) {}

  /** Runs an ALREADY-SAVED report definition — re-validated against the registry at run time too, in case the registry itself changed since the report was saved. */
  async run(companyId: string, id: string) {
    const def = await this.reportDefinitionsService.findOne(companyId, id);
    return this.execute(
      companyId,
      def.entityType,
      def.groupByField,
      def.aggregateType as 'count' | 'sum',
      def.aggregateField,
      (def.filters as unknown as ReportFilter[]) ?? [],
    );
  }

  /** Runs a definition WITHOUT saving it first — lets the UI preview a report before the user commits to saving it. */
  async runAdHoc(companyId: string, dto: CreateReportDefinitionDto) {
    return this.execute(companyId, dto.entityType, dto.groupByField, dto.aggregateType, dto.aggregateField ?? null, dto.filters ?? []);
  }

  private async execute(
    companyId: string,
    entityType: string,
    groupByField: string,
    aggregateType: 'count' | 'sum',
    aggregateField: string | null,
    filters: ReportFilter[],
  ) {
    const config = REPORTS_REGISTRY[entityType];
    if (!config) {
      throw new UnprocessableEntityException(`"${entityType}" is not a reportable entity.`);
    }
    if (!config.groupByFields.some((f) => f.field === groupByField)) {
      throw new UnprocessableEntityException(`"${groupByField}" is not a valid group-by field for "${entityType}".`);
    }
    if (aggregateType === 'sum' && !config.sumFields.some((f) => f.field === aggregateField)) {
      throw new UnprocessableEntityException(`"${aggregateField}" is not a valid sum field for "${entityType}".`);
    }
    for (const filter of filters) {
      if (!config.filterFields.some((f) => f.field === filter.field)) {
        throw new UnprocessableEntityException(`"${filter.field}" is not a valid filter field for "${entityType}".`);
      }
    }

    return config.run(this.prisma, companyId, groupByField, aggregateType, aggregateField, filters);
  }
}
