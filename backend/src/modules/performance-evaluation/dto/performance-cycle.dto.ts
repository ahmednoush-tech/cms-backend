import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePerformanceCycleDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class UpdatePerformanceCycleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(['open', 'closed'])
  status?: 'open' | 'closed';
}
