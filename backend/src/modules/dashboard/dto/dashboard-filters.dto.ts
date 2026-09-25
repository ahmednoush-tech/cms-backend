import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Shared filter set across all four Dashboard endpoints. Per the
 * approved design (Phase 2E, section 4), not every filter applies
 * to every KPI — an inapplicable filter is silently a no-op for
 * the KPIs it doesn't apply to, never an error. Each service
 * method documents which filters it actually reads.
 */
export class DashboardFiltersDto {
  @ApiPropertyOptional({ description: 'ISO date — inclusive lower bound, applied to the date field documented per KPI' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date — inclusive upper bound' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Narrows a "by status" breakdown to one bucket — has no effect on point-in-time counts already defined by a fixed status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'urgent'] })
  @IsOptional()
  @IsString()
  priority?: string;
}
