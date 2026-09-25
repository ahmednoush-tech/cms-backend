import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** P1 FIX (V1 Final System Audit, section 7/13) — see ProjectFiltersDto (Operations) for the full rationale. */
export class QuotationFiltersDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @ApiPropertyOptional({ enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'] })
  @IsOptional()
  @IsString()
  status?: string;
}
