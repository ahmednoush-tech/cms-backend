import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateInteractionDto {
  @IsIn(['call', 'meeting', 'email', 'note', 'other'])
  @IsOptional()
  type?: 'call' | 'meeting' | 'email' | 'note' | 'other';

  @IsString()
  @IsOptional()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  interactionDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  outcome?: string;

  @IsDateString()
  @IsOptional()
  followUpDate?: string;

  // Deliberately no `customerId`/`leadId`/`opportunityId` —
  // re-linking a logged interaction to a different record after
  // the fact is significant enough that deleting and re-creating
  // it is clearer than an in-place identity change.
}
