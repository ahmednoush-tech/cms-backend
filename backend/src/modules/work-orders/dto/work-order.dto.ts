import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const WORK_ORDER_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const WORK_ORDER_STATUSES = ['new', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled'];

export class CreateWorkOrderDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, enum: WORK_ORDER_PRIORITIES, default: 'medium' })
  @IsOptional()
  @IsIn(WORK_ORDER_PRIORITIES)
  priority?: string;

  @ApiProperty({ required: false, description: 'Must be an active employee in the same company' })
  @IsOptional()
  @IsUUID()
  assignedToEmployeeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  // NOTE: customerId is intentionally NOT accepted here — it is
  // always server-derived from the parent project's customerId
  // (Phase 2D design decision #6). companyId and workOrderNumber
  // are also server-derived/generated, never client input.
}

export class UpdateWorkOrderDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, enum: WORK_ORDER_PRIORITIES })
  @IsOptional()
  @IsIn(WORK_ORDER_PRIORITIES)
  priority?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateWorkOrderStatusDto {
  @ApiProperty({ enum: WORK_ORDER_STATUSES })
  @IsIn(WORK_ORDER_STATUSES)
  status: string;
}

export class AssignWorkOrderDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;
}
