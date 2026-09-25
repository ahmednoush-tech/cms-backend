import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateMaintenanceRecordDto {
  @IsDateString()
  serviceDate: string;

  @IsString()
  @MinLength(1)
  serviceType: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  cost?: number;

  @IsInt()
  @Min(0)
  odometerAtService: number;

  @IsString()
  @IsOptional()
  performedBy?: string;
}
