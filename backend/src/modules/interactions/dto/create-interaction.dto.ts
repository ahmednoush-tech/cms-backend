import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateInteractionDto {
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  leadId?: string;

  @IsUUID()
  @IsOptional()
  opportunityId?: string;

  @IsIn(['call', 'meeting', 'email', 'note', 'other'])
  type: 'call' | 'meeting' | 'email' | 'note' | 'other';

  @IsString()
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  interactionDate: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  outcome?: string;

  @IsDateString()
  @IsOptional()
  followUpDate?: string;
}
