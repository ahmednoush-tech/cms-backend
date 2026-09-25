import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

export class CreateLeadDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyName?: string;

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
  source?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, description: 'defaults to the creating user' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiProperty({ required: false, description: 'Keys must match an active custom field definition for leads — see GET /custom-field-definitions?entityType=lead.' })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateLeadDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyName?: string;

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
  source?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiProperty({ required: false, description: 'Merged with existing custom field values, not replaced wholesale — see LeadsService.update().' })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateLeadStatusDto {
  @ApiProperty({ enum: LEAD_STATUSES })
  @IsIn(LEAD_STATUSES)
  status: string;
}

/**
 * Lead -> Convert -> Customer + Contact -> optional Opportunity.
 *
 * customerType/customerCode are now fallback-only fields: the
 * service first tries to auto-match an existing customer (by
 * explicit existingCustomerId, then by email, then by company
 * name) before ever creating a new one, so these are only
 * required when no match is found and a new customer must be
 * created — enforced in the service, not at the DTO layer, since
 * whether a match exists can't be known until the DB is queried.
 */
export class ConvertLeadDto {
  @ApiProperty({
    required: false,
    description:
      'Force-link to a specific existing customer, skipping auto-matching entirely.',
  })
  @IsOptional()
  @IsUUID()
  existingCustomerId?: string;

  @ApiProperty({
    enum: ['company', 'individual'],
    required: false,
    description: 'Used only if no existing customer is matched and a new one must be created.',
  })
  @IsOptional()
  @IsIn(['company', 'individual'])
  customerType?: 'company' | 'individual';

  @ApiProperty({ required: false, description: 'Used only when creating a new "company" customer' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({
    required: false,
    description: 'Used only if no existing customer is matched; unique per company.',
  })
  @IsOptional()
  @IsString()
  customerCode?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  createContact?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  createOpportunity?: boolean;

  @ApiProperty({ required: false, description: 'Required if createOpportunity is true' })
  @IsOptional()
  @IsString()
  opportunityName?: string;
}
