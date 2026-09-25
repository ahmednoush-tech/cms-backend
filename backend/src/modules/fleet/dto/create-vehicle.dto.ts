import { IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @MinLength(1)
  plateNumber: string;

  @IsString()
  @MinLength(1)
  make: string;

  @IsString()
  @MinLength(1)
  model: string;

  @IsInt()
  @IsOptional()
  year?: number;

  @IsString()
  @IsOptional()
  vin?: string;

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
