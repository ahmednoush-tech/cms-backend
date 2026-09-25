import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateEmployeeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiProperty({ required: false, enum: ['active', 'inactive', 'terminated'] })
  @IsOptional()
  @IsIn(['active', 'inactive', 'terminated'])
  status?: string;

  @ApiProperty({ required: false, description: 'Monthly basic salary (SAR). Required before this employee can be included in a payroll run.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basicSalary?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  housingAllowance?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  otherAllowances?: number;

  @ApiProperty({ required: false, description: 'GOSI employee contribution rate as a percentage (e.g. 9.75). Verify against gosi.gov.sa — never defaulted by this system.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gosiEmployeeRate?: number;

  @ApiProperty({ required: false, description: 'GOSI employer contribution rate as a percentage (e.g. 11.75). Verify against gosi.gov.sa — never defaulted by this system.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gosiEmployerRate?: number;

  @ApiProperty({ required: false, description: 'Used to cost time entries logged against this employee.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiProperty({ required: false, description: 'Iqama (Saudi residency permit) number, for foreign employees.' })
  @IsOptional()
  @IsString()
  iqamaNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  iqamaExpiryDate?: string;
}
