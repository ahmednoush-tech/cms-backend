import { IsBoolean, IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

const ENTITY_TYPES = ['lead', 'opportunity'];
const EVENTS = ['created', 'stage_changed'];

export class CreateAutomationRuleDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsIn(ENTITY_TYPES)
  triggerEntityType: 'lead' | 'opportunity';

  @IsIn(EVENTS)
  triggerEvent: 'created' | 'stage_changed';

  /** Required when triggerEvent is 'stage_changed', and must be omitted for 'created' — enforced again here, not just by the DB's CHECK constraint, so the error surfaces as a clean 400 instead of a raw constraint violation. */
  @ValidateIf((o) => o.triggerEvent === 'stage_changed')
  @IsString()
  @MinLength(1)
  triggerToStage?: string;

  @IsString()
  @MinLength(1)
  notificationTitle: string;

  @IsOptional()
  @IsString()
  notificationMessage?: string;
}
