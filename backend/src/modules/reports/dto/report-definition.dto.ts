import { IsArray, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportFilterDto {
  @IsString()
  field: string;

  @IsIn(['eq'])
  operator: 'eq';

  @IsString()
  value: string;
}

export class CreateReportDefinitionDto {
  @IsString()
  @MinLength(1)
  name: string;

  /**
   * class-validator only checks this is a non-empty string here —
   * the REAL check (is this one of the entities actually in
   * REPORTS_REGISTRY?) happens in the service, since that registry
   * is the single source of truth and duplicating its keys into a
   * decorator here would just be a second place to keep in sync.
   */
  @IsString()
  @MinLength(1)
  entityType: string;

  @IsString()
  @MinLength(1)
  groupByField: string;

  @IsIn(['count', 'sum'])
  aggregateType: 'count' | 'sum';

  @IsOptional()
  @IsString()
  aggregateField?: string;

  @IsOptional()
  @IsIn(['bar', 'line', 'table'])
  chartType?: 'bar' | 'line' | 'table';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFilterDto)
  filters?: ReportFilterDto[];
}

/** Same shape as create, all optional — a saved report can be fully re-edited, not just renamed. Re-validated against REPORTS_REGISTRY exactly like create(). */
export class UpdateReportDefinitionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  groupByField?: string;

  @IsOptional()
  @IsIn(['count', 'sum'])
  aggregateType?: 'count' | 'sum';

  @IsOptional()
  @IsString()
  aggregateField?: string;

  @IsOptional()
  @IsIn(['bar', 'line', 'table'])
  chartType?: 'bar' | 'line' | 'table';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFilterDto)
  filters?: ReportFilterDto[];
}
