import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

const PROJECT_STATUSES = ['planning', 'approved', 'in_progress', 'on_hold', 'completed', 'cancelled'];

export class CreateProjectDto {
  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @ApiProperty({
    required: false,
    description: 'If supplied, must belong to the same customer and have status "accepted".',
  })
  @IsOptional()
  @IsUUID()
  quotationId?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, description: 'Must be an active employee in the same company' })
  @IsOptional()
  @IsUUID()
  projectManagerId?: string;

  // NOTE: companyId, projectNumber, and status are intentionally
  // NOT accepted here. companyId is always server-derived from the
  // authenticated context; projectNumber is server-generated
  // (unique per company); status always starts at 'planning'.
}

export class UpdateProjectDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  // NOTE: projectManagerId is intentionally NOT editable here —
  // changing the project manager goes through the dedicated
  // POST /:id/assign-manager action (Operations:projects:assign
  // permission), which also handles the project_members sync.
  // customerId/opportunityId/quotationId are also not editable
  // post-creation in V1 (not requested; moving a project to a
  // different customer is a bigger operation than an update).
}

export class UpdateProjectStatusDto {
  @ApiProperty({ enum: PROJECT_STATUSES })
  @IsIn(PROJECT_STATUSES)
  status: string;
}

export class AssignProjectManagerDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;
}
