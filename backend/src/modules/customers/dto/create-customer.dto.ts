import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ enum: ['company', 'individual'] })
  @IsIn(['company', 'individual'])
  customerType: 'company' | 'individual';

  @ApiProperty({ required: false, description: 'Required when customerType is "company"' })
  @ValidateIf((o) => o.customerType === 'company')
  @IsString()
  companyName?: string;

  @ApiProperty({ description: 'Unique per company, e.g. CUST-0001' })
  @IsString()
  customerCode: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false, description: '15-digit VAT registration number — required on the customer for a ZATCA Phase 2 invoice to be classified as Standard/B2B (subject to clearance) rather than Simplified/B2C (reporting only).' })
  @IsOptional()
  @IsString()
  vatRegistrationNumber?: string;

  @ApiProperty({ required: false, description: 'users.id — defaults to the creating user if omitted' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiProperty({ required: false, description: 'Keys must match an active custom field definition for customers — see GET /custom-field-definitions?entityType=customer.' })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
