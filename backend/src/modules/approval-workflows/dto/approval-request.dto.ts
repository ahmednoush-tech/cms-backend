import { IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateApprovalRequestDto {
  @IsUUID()
  workflowId: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}

export class ApprovalActionDto {
  @IsOptional()
  @IsString()
  comments?: string;
}
