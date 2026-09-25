import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateVehicleDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  make?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  model?: string;

  @IsInt()
  @IsOptional()
  year?: number;

  @IsString()
  @IsOptional()
  vin?: string;

  @IsIn(['active', 'maintenance', 'retired'])
  @IsOptional()
  status?: 'active' | 'maintenance' | 'retired';

  @IsInt()
  @IsOptional()
  @Min(0)
  odometerReading?: number;

  @IsDateString()
  @IsOptional()
  registrationExpiryDate?: string;

  @IsDateString()
  @IsOptional()
  insuranceExpiryDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
