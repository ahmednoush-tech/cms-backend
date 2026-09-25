import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AnalyticsRangeQueryDto {
  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;
}

export class RevenueTrendQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  @IsOptional()
  months?: number;
}

export class TopCustomersQueryDto extends AnalyticsRangeQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}
