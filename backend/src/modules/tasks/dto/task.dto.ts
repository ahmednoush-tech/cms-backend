import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];

export class CreateTaskDto {
  @ApiProperty({ required: false, description: 'At least one of projectId/workOrderId is required' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiProperty({ required: false, description: 'At least one of projectId/workOrderId is required' })
  @IsOptional()
  @IsUUID()
  workOrderId?: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, enum: TASK_PRIORITIES, default: 'medium' })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assignedToEmployeeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateTaskDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  // NOTE: projectId/workOrderId are intentionally immutable after
  // creation in V1 — not explicitly requested either way; changing
  // a task's parent after creation is judged out of scope for this
  // phase and not offered, rather than half-implemented.
}

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: TASK_STATUSES })
  @IsIn(TASK_STATUSES)
  status: string;
}

export class AssignTaskDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;
}
