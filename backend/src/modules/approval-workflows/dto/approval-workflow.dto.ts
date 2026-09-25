import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WorkflowStepInputDto {
  @IsUUID()
  approverRoleId: string;
}

export class CreateApprovalWorkflowDto {
  @IsString()
  @MinLength(1)
  name: string;

  /** Ordered by array position — the first entry is step 1, and so on. Must have at least one step, or nothing could ever approve a request. */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepInputDto)
  steps: WorkflowStepInputDto[];
}

export class UpdateApprovalWorkflowDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Replaces the FULL step list when provided — a workflow's steps are edited as a whole ordered chain, not patched field-by-field. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepInputDto)
  steps?: WorkflowStepInputDto[];
}
