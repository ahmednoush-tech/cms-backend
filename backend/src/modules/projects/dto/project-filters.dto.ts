import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * P1 FIX (V1 Final System Audit, section 7/13): the controller
 * previously typed `@Query()` as the bare PaginationQueryDto,
 * which does not declare `customerId`/`status`. Under the global
 * ValidationPipe (`whitelist: true, forbidNonWhitelisted: true`
 * in main.ts), any query-string property not declared on the
 * class the parameter is typed as gets stripped (whitelist) and,
 * with forbidNonWhitelisted also on, causes the whole request to
 * be rejected with 400 — so these filters could never have
 * reached the service. This DTO declares every filter field the
 * service actually reads, so it survives the pipe and is passed
 * through with real validation instead of an `as any` cast.
 */
export class ProjectFiltersDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    enum: ['planning', 'approved', 'in_progress', 'on_hold', 'completed', 'cancelled'],
  })
  @IsOptional()
  @IsString()
  status?: string;
}
